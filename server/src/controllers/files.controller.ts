import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import * as storage from "../services/storage.service";
import { NotFoundError } from "../errors/not-found.error";
import config from "../config";

export async function listJobFiles(req: Request, res: Response, next: NextFunction) {
  try {
    const { jobId } = req.params;
    const files = await storage.getJobFiles(jobId);

    res.json({
      success: true,
      data: files.map((f) => ({
        filename: f.filename,
        size: f.size,
        mimeType: f.mimeType,
        downloadUrl: `/api/v1/files/${jobId}/${encodeURIComponent(f.filename)}`,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function downloadFile(req: Request, res: Response, next: NextFunction) {
  try {
    const { jobId } = req.params;
    // The filename can include subdirectories
    const filename = req.params[0] || req.params.filename;

    if (!filename) {
      throw new NotFoundError("Filename is required");
    }

    const filePath = path.join(config.OUTPUT_DIR, jobId, filename);

    // Security: ensure path doesn't escape output directory
    const resolvedPath = path.resolve(filePath);
    const resolvedOutputDir = path.resolve(config.OUTPUT_DIR);
    if (!resolvedPath.startsWith(resolvedOutputDir)) {
      throw new NotFoundError("File not found");
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new NotFoundError(`File not found: ${filename}`);
    }

    const stat = fs.statSync(resolvedPath);
    const ext = path.extname(filename).toLowerCase();

    // Set content type
    const mimeTypes: Record<string, string> = {
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mkv": "video/x-matroska",
      ".avi": "video/x-msvideo",
      ".mov": "video/quicktime",
      ".mp3": "audio/mpeg",
      ".aac": "audio/aac",
      ".wav": "audio/wav",
      ".flac": "audio/flac",
      ".ogg": "audio/ogg",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".m3u8": "application/vnd.apple.mpegurl",
      ".ts": "video/mp2t",
      ".mpd": "application/dash+xml",
      ".m4s": "video/iso.segment",
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stat.size);

    // For video/audio, support range requests
    if (contentType.startsWith("video/") || contentType.startsWith("audio/")) {
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Content-Length", chunkSize);

        const stream = fs.createReadStream(resolvedPath, { start, end });
        stream.pipe(res);
        return;
      }
    }

    // Stream the file
    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

export async function streamUploadedFile(req: Request, res: Response, next: NextFunction) {
  try {
    const { filename } = req.params;
    const filePath = path.join(config.UPLOAD_DIR, filename);

    // Security check
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadDir = path.resolve(config.UPLOAD_DIR);
    if (!resolvedPath.startsWith(resolvedUploadDir)) {
      throw new NotFoundError("File not found");
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new NotFoundError(`File not found: ${filename}`);
    }

    const stat = fs.statSync(resolvedPath);
    const ext = path.extname(filename).toLowerCase();

    const mimeTypes: Record<string, string> = {
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mkv": "video/x-matroska",
      ".avi": "video/x-msvideo",
      ".mov": "video/quicktime",
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Accept-Ranges", "bytes");

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      res.setHeader("Content-Length", chunkSize);

      const stream = fs.createReadStream(resolvedPath, { start, end });
      stream.pipe(res);
      return;
    }

    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}
