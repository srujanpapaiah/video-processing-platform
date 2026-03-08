import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/base.error";
import { ValidationError } from "../errors/validation.error";
import logger from "../utils/logger";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      details: err.details,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Multer errors
  if (err.message?.includes("File too large")) {
    res.status(413).json({
      success: false,
      error: "File too large",
    });
    return;
  }

  if (err.message?.includes("Invalid file type")) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Unknown errors
  logger.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message,
  });
}
