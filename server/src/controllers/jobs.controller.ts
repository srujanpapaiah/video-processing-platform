import { Request, Response, NextFunction } from "express";
import * as queueService from "../services/queue.service";
import * as storageService from "../services/storage.service";
import { getVideoMetadata } from "../services/ffprobe.service";
import { cancelJob as cancelFFmpeg } from "../services/ffmpeg.service";
import { NotFoundError } from "../errors/not-found.error";
import { BadRequestError } from "../errors/bad-request.error";
import { JobData } from "../types";
import config from "../config";
import path from "path";
import logger from "../utils/logger";

export async function uploadFile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new BadRequestError("No file uploaded");
    }

    const metadata = await getVideoMetadata(req.file.path).catch(() => null);

    res.status(200).json({
      success: true,
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        metadata,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function uploadMultipleFiles(req: Request, res: Response, next: NextFunction) {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new BadRequestError("No files uploaded");
    }

    const fileInfos = files.map((f) => ({
      filename: f.filename,
      originalName: f.originalname,
      size: f.size,
      mimeType: f.mimetype,
    }));

    res.status(200).json({
      success: true,
      data: fileInfos,
    });
  } catch (err) {
    next(err);
  }
}

export async function createJob(req: Request, res: Response, next: NextFunction) {
  try {
    const { operation, options = {} } = req.body;
    const file = req.file;

    if (!file) {
      throw new BadRequestError("No video file uploaded");
    }

    const jobData: JobData = {
      operation,
      inputFile: file.filename,
      originalFilename: file.originalname,
      options,
    };

    const job = await queueService.addJob(jobData);

    res.status(201).json({
      success: true,
      data: {
        jobId: job.id,
        operation,
        originalFilename: file.originalname,
        message: "Job queued for processing",
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createJobFromUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const { operation, options = {}, filename, originalFilename } = req.body;

    if (!filename) {
      throw new BadRequestError("filename is required (from a previous upload)");
    }

    const jobData: JobData = {
      operation,
      inputFile: filename,
      originalFilename: originalFilename || filename,
      options,
    };

    const job = await queueService.addJob(jobData);

    res.status(201).json({
      success: true,
      data: {
        jobId: job.id,
        operation,
        originalFilename: originalFilename || filename,
        message: "Job queued for processing",
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function listJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const { page = 1, limit = 20, status = "all", operation } = req.query as any;

    const { jobs, total } = await queueService.getJobs(status, page, limit, operation);

    res.json({
      success: true,
      data: jobs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getJob(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const job = await queueService.getJob(id);

    if (!job) {
      throw new NotFoundError(`Job ${id} not found`);
    }

    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
}

export async function probeJob(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const job = await queueService.getJob(id);

    if (!job) {
      throw new NotFoundError(`Job ${id} not found`);
    }

    const inputPath = path.join(config.UPLOAD_DIR, job.inputFile);
    const metadata = await getVideoMetadata(inputPath);

    res.json({ success: true, data: metadata });
  } catch (err) {
    next(err);
  }
}

export async function retryJob(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const success = await queueService.retryJob(id);

    if (!success) {
      throw new NotFoundError(`Job ${id} not found`);
    }

    res.json({ success: true, message: `Job ${id} retried` });
  } catch (err) {
    next(err);
  }
}

export async function cancelJobHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    // Cancel FFmpeg process if running
    cancelFFmpeg(id);

    const success = await queueService.cancelJob(id);
    if (!success) {
      throw new NotFoundError(`Job ${id} not found`);
    }

    res.json({ success: true, message: `Job ${id} cancelled` });
  } catch (err) {
    next(err);
  }
}

export async function deleteJob(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    // Cancel FFmpeg if running
    cancelFFmpeg(id);

    // Clean up files
    await storageService.cleanupJob(id);

    // Remove from queue
    await queueService.removeJob(id);

    res.json({ success: true, message: `Job ${id} deleted` });
  } catch (err) {
    next(err);
  }
}
