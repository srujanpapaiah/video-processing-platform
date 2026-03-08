import { Request, Response, NextFunction } from "express";
import { getQueueStats } from "../services/queue.service";
import { getSystemStats } from "../utils/system";

export async function healthCheck(_req: Request, res: Response, _next: NextFunction) {
  res.json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
}

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const [queueStats, systemStats] = await Promise.all([
      getQueueStats(),
      getSystemStats(),
    ]);

    res.json({
      success: true,
      data: {
        queue: queueStats,
        system: systemStats,
      },
    });
  } catch (err) {
    next(err);
  }
}
