import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import apiRouter from "./routes";
import { errorHandler } from "./middlewares/error-handler";
import { getQueue } from "./services/queue.service";
import config from "./config";
import logger from "./utils/logger";

const app = express();

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: config.CORS_ORIGINS,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// ─── Body Parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Request Logging ─────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  if (!req.path.startsWith("/admin") && !req.path.includes("socket.io")) {
    logger.debug(`${req.method} ${req.path}`);
  }
  next();
});

// ─── Bull Board ──────────────────────────────────────────────────────────────
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
createBullBoard({
  queues: [new BullMQAdapter(getQueue())],
  serverAdapter,
});
app.use("/admin/queues", serverAdapter.getRouter());

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use("/api/v1", apiRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
