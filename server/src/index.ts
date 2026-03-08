import http from "http";
import app from "./app";
import config from "./config";
import logger from "./utils/logger";
import { ensureDirectories } from "./services/storage.service";
import { initializeSocketIO, closeSocketIO } from "./socket";
import { initializeWorker, closeWorker } from "./workers/video.worker";
import { closeQueue } from "./services/queue.service";

async function main() {
  // Ensure storage directories exist
  ensureDirectories();
  logger.info(`Upload directory: ${config.UPLOAD_DIR}`);
  logger.info(`Output directory: ${config.OUTPUT_DIR}`);

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize Socket.IO
  const io = initializeSocketIO(server);

  // Initialize BullMQ worker
  initializeWorker(io);

  // Start listening
  server.listen(config.PORT, () => {
    logger.info(`🚀 Video Processing Server running on port ${config.PORT}`);
    logger.info(`📊 Bull Board: http://localhost:${config.PORT}/admin/queues`);
    logger.info(`🔌 Socket.IO: ws://localhost:${config.PORT}`);
    logger.info(`📡 API: http://localhost:${config.PORT}/api/v1`);
    logger.info(`Environment: ${config.NODE_ENV}`);
  });

  // ─── Graceful Shutdown ───────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(() => {
      logger.info("HTTP server closed");
    });

    try {
      // Close worker (waits for active jobs to finish)
      await closeWorker();

      // Close Socket.IO
      closeSocketIO();

      // Close queue and Redis
      await closeQueue();

      logger.info("Graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception:", error);
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection:", reason);
  });
}

main().catch((error) => {
  logger.error("Failed to start server:", error);
  process.exit(1);
});
