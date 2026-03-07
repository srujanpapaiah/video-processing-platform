import { Queue, Job } from "bullmq";
import Redis from "bullmq/node_modules/ioredis";
import config from "../config";
import logger from "../utils/logger";
import { JobData, QueueStats, SerializedJob, JobResult } from "../types";

type RedisConnection = InstanceType<typeof Redis>;
let connection: RedisConnection;

export function getRedisConnection(): RedisConnection {
  if (!connection) {
    connection = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    connection.on("error", (err: Error) => {
      logger.error("Redis connection error:", err);
    });
    connection.on("connect", () => {
      logger.info("Redis connected");
    });
  }
  return connection;
}

let queue: Queue;

export function getQueue(): Queue {
  if (!queue) {
    queue = new Queue("video-processing", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      },
    });
    logger.info("BullMQ queue initialized");
  }
  return queue;
}

export async function addJob(data: JobData): Promise<Job> {
  const q = getQueue();
  const job = await q.add(data.operation, data, {
    jobId: undefined, // auto-generate
  });
  logger.info(`Job ${job.id} added: ${data.operation} for ${data.originalFilename}`);
  return job;
}

function serializeJob(job: Job): SerializedJob {
  const state = job.finishedOn
    ? job.failedReason ? "failed" : "completed"
    : job.processedOn ? "active" : "waiting";

  return {
    id: job.id!,
    operation: job.data.operation,
    status: state,
    progress: typeof job.progress === "number" ? job.progress : 0,
    inputFile: job.data.inputFile,
    originalFilename: job.data.originalFilename,
    options: job.data.options,
    result: job.returnvalue || undefined,
    failedReason: job.failedReason || undefined,
    createdAt: job.timestamp,
    processedAt: job.processedOn || undefined,
    finishedAt: job.finishedOn || undefined,
    attemptsMade: job.attemptsMade,
  };
}

export async function getJob(jobId: string): Promise<SerializedJob | null> {
  const q = getQueue();
  const job = await q.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const serialized = serializeJob(job);
  serialized.status = state;
  return serialized;
}

export async function getJobs(
  status: string = "all",
  page: number = 1,
  limit: number = 20,
  operation?: string
): Promise<{ jobs: SerializedJob[]; total: number }> {
  const q = getQueue();

  const statuses = status === "all"
    ? ["waiting", "active", "completed", "failed", "delayed"] as const
    : [status as "waiting" | "active" | "completed" | "failed" | "delayed"];

  let allJobs: Job[] = [];

  for (const s of statuses) {
    const jobs = await q.getJobs([s], 0, 500);
    allJobs = allJobs.concat(jobs);
  }

  // Filter by operation if provided
  if (operation) {
    allJobs = allJobs.filter((j) => j.data?.operation === operation);
  }

  // Sort by timestamp descending (newest first)
  allJobs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const total = allJobs.length;
  const start = (page - 1) * limit;
  const paged = allJobs.slice(start, start + limit);

  const serialized: SerializedJob[] = [];
  for (const job of paged) {
    const state = await job.getState();
    const s = serializeJob(job);
    s.status = state;
    serialized.push(s);
  }

  return { jobs: serialized, total };
}

export async function retryJob(jobId: string): Promise<boolean> {
  const q = getQueue();
  const job = await q.getJob(jobId);
  if (!job) return false;

  await job.retry();
  logger.info(`Job ${jobId} retried`);
  return true;
}

export async function cancelJob(jobId: string): Promise<boolean> {
  const q = getQueue();
  const job = await q.getJob(jobId);
  if (!job) return false;

  const state = await job.getState();
  if (state === "active") {
    // Signal the worker to cancel the FFmpeg process
    await job.moveToFailed(new Error("Cancelled by user"), "0");
  } else if (state === "waiting" || state === "delayed") {
    await job.remove();
  }

  logger.info(`Job ${jobId} cancelled`);
  return true;
}

export async function removeJob(jobId: string): Promise<boolean> {
  const q = getQueue();
  const job = await q.getJob(jobId);
  if (!job) return false;

  await job.remove();
  logger.info(`Job ${jobId} removed`);
  return true;
}

export async function getQueueStats(): Promise<QueueStats> {
  const q = getQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    q.getWaitingCount(),
    q.getActiveCount(),
    q.getCompletedCount(),
    q.getFailedCount(),
    q.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    logger.info("Queue closed");
  }
  if (connection) {
    connection.disconnect();
    logger.info("Redis disconnected");
  }
}
