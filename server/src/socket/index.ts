import { Server as SocketServer } from "socket.io";
import { Server as HttpServer } from "http";
import { getQueueStats } from "../services/queue.service";
import logger from "../utils/logger";
import config from "../config";

let io: SocketServer | null = null;
let statsInterval: ReturnType<typeof setInterval> | null = null;

export function initializeSocketIO(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: config.CORS_ORIGINS,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on("subscribe:job", (data: { jobId: string }) => {
      socket.join(`job:${data.jobId}`);
      logger.debug(`Socket ${socket.id} subscribed to job ${data.jobId}`);
    });

    socket.on("unsubscribe:job", (data: { jobId: string }) => {
      socket.leave(`job:${data.jobId}`);
    });

    socket.on("disconnect", () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });

  // Broadcast queue stats every 2 seconds
  statsInterval = setInterval(async () => {
    try {
      const stats = await getQueueStats();
      io?.emit("queue:stats", stats);
    } catch (err) {
      // Silently ignore stats errors
    }
  }, 2000);

  logger.info("Socket.IO initialized");
  return io;
}

export function getIO(): SocketServer | null {
  return io;
}

export function closeSocketIO(): void {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  if (io) {
    io.close();
    logger.info("Socket.IO closed");
  }
}
