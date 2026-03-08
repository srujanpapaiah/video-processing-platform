import { Worker, Job } from "bullmq";
import path from "path";
import { Server as SocketServer } from "socket.io";
import { getRedisConnection } from "../services/queue.service";
import * as ffmpegService from "../services/ffmpeg.service";
import * as storage from "../services/storage.service";
import { JobData, JobResult, FFmpegProgress, OutputFileInfo } from "../types";
import config from "../config";
import logger from "../utils/logger";

let io: SocketServer | null = null;
let worker: Worker | null = null;

export function initializeWorker(socketIo: SocketServer): Worker {
  io = socketIo;

  worker = new Worker(
    "video-processing",
    async (job: Job) => {
      return processJob(job);
    },
    {
      connection: getRedisConnection(),
      concurrency: config.MAX_CONCURRENT_JOBS,
    }
  );

  worker.on("completed", (job) => {
    logger.info(`Job ${job.id} completed`);
    if (io) {
      io.emit("job:completed", {
        jobId: job.id,
        result: job.returnvalue,
      });
    }
  });

  worker.on("failed", (job, err) => {
    logger.error(`Job ${job?.id} failed:`, err);
    if (io && job) {
      io.emit("job:failed", {
        jobId: job.id,
        error: err.message,
      });
    }
  });

  worker.on("active", (job) => {
    logger.info(`Job ${job.id} started processing`);
    if (io) {
      io.emit("job:active", { jobId: job.id });
    }
  });

  worker.on("error", (err) => {
    logger.error("Worker error:", err);
  });

  logger.info(`Video processing worker started (concurrency: ${config.MAX_CONCURRENT_JOBS})`);
  return worker;
}

async function processJob(job: Job): Promise<JobResult> {
  const { operation, inputFile, options } = job.data;
  const jobId = job.id!;
  const startTime = Date.now();

  const outputDir = storage.getOutputDir(jobId);
  const inputPath = path.join(config.UPLOAD_DIR, inputFile);

  const onProgress = (progress: FFmpegProgress) => {
    const percent = Math.min(Math.round(progress.percent || 0), 100);
    job.updateProgress(percent);
    if (io) {
      io.emit("job:progress", {
        jobId,
        progress: percent,
        currentFps: progress.currentFps,
        speed: progress.speed,
        timemark: progress.timemark,
      });
    }
  };

  let outputFiles: OutputFileInfo[] = [];

  try {
    switch (operation) {
      case "compress": {
        const outputPath = path.join(outputDir, `compressed_${job.data.originalFilename}`);
        await ffmpegService.compress(inputPath, outputPath, options, jobId, onProgress);
        break;
      }
      case "transcode": {
        const format = (options.format as string) || "mp4";
        const baseName = path.parse(job.data.originalFilename).name;
        const outputPath = path.join(outputDir, `${baseName}.${format}`);
        await ffmpegService.transcode(inputPath, outputPath, options, jobId, onProgress);
        break;
      }
      case "hls": {
        await ffmpegService.generateHLS(inputPath, outputDir, options, jobId, onProgress);
        break;
      }
      case "dash": {
        await ffmpegService.generateDASH(inputPath, outputDir, options, jobId, onProgress);
        break;
      }
      case "thumbnail": {
        await ffmpegService.generateThumbnails(inputPath, outputDir, options, jobId, onProgress);
        break;
      }
      case "trim": {
        const outputPath = path.join(outputDir, `trimmed_${job.data.originalFilename}`);
        await ffmpegService.trim(inputPath, outputPath, options, jobId, onProgress);
        break;
      }
      case "resize": {
        const outputPath = path.join(outputDir, `resized_${job.data.originalFilename}`);
        await ffmpegService.resize(inputPath, outputPath, options, jobId, onProgress);
        break;
      }
      case "watermark": {
        const outputPath = path.join(outputDir, `watermarked_${job.data.originalFilename}`);
        await ffmpegService.watermark(inputPath, outputPath, options, jobId, onProgress);
        break;
      }
      case "extract-audio": {
        const format = (options.format as string) || "mp3";
        const baseName = path.parse(job.data.originalFilename).name;
        const outputPath = path.join(outputDir, `${baseName}.${format}`);
        await ffmpegService.extractAudio(inputPath, outputPath, options, jobId, onProgress);
        break;
      }
      case "gif": {
        const baseName = path.parse(job.data.originalFilename).name;
        const outputPath = path.join(outputDir, `${baseName}.gif`);
        await ffmpegService.createGif(inputPath, outputPath, options, jobId, onProgress);
        break;
      }
      case "merge": {
        const inputFiles = (options.inputFiles as string[]) || [];
        const resolvedInputs = inputFiles.map((f: string) => path.join(config.UPLOAD_DIR, f));
        resolvedInputs.unshift(inputPath);
        const outputPath = path.join(outputDir, `merged_${job.data.originalFilename}`);
        await ffmpegService.merge(resolvedInputs, outputPath, options, jobId, onProgress);
        break;
      }
      case "add-subtitles": {
        const subtitleFile = options.subtitleFile
          ? path.join(config.UPLOAD_DIR, options.subtitleFile as string)
          : undefined;
        const outputPath = path.join(outputDir, `subtitled_${job.data.originalFilename}`);
        await ffmpegService.addSubtitles(inputPath, outputPath, { ...options, subtitleFile }, jobId, onProgress);
        break;
      }
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    // Collect output files
    outputFiles = await storage.getJobFiles(jobId);

    const duration = Date.now() - startTime;
    logger.info(`Job ${jobId} completed in ${duration}ms with ${outputFiles.length} output files`);

    await job.updateProgress(100);
    if (io) {
      io.emit("job:progress", { jobId, progress: 100 });
    }

    return { outputFiles, duration };
  } catch (error: any) {
    logger.error(`Job ${jobId} failed:`, error);
    throw error;
  }
}

export async function closeWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    logger.info("Worker closed");
  }
}
