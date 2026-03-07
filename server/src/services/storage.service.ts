import fs from "fs";
import path from "path";
import config from "../config";
import logger from "../utils/logger";
import { OutputFileInfo } from "../types";

// Ensure directories exist
export function ensureDirectories(): void {
  for (const dir of [config.UPLOAD_DIR, config.OUTPUT_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  }
}

export function getUploadPath(filename: string): string {
  return path.join(config.UPLOAD_DIR, filename);
}

export function getOutputDir(jobId: string): string {
  const dir = path.join(config.OUTPUT_DIR, jobId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getOutputFilePath(jobId: string, filename: string): string {
  return path.join(getOutputDir(jobId), filename);
}

const mimeMap: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".flv": "video/x-flv",
  ".ogg": "video/ogg",
  ".mp3": "audio/mpeg",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".mpd": "application/dash+xml",
  ".m4s": "video/iso.segment",
  ".srt": "text/plain",
  ".vtt": "text/vtt",
};

export async function getJobFiles(jobId: string): Promise<OutputFileInfo[]> {
  const dir = path.join(config.OUTPUT_DIR, jobId);
  if (!fs.existsSync(dir)) return [];

  const files: OutputFileInfo[] = [];

  const walkDir = async (currentDir: string, prefix = "") => {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walkDir(fullPath, relativePath);
      } else {
        const stat = await fs.promises.stat(fullPath);
        const ext = path.extname(entry.name).toLowerCase();
        files.push({
          filename: relativePath,
          path: fullPath,
          size: stat.size,
          mimeType: mimeMap[ext] || "application/octet-stream",
        });
      }
    }
  };

  await walkDir(dir);
  return files;
}

export async function cleanupJob(jobId: string): Promise<void> {
  // Remove output directory
  const outputDir = path.join(config.OUTPUT_DIR, jobId);
  if (fs.existsSync(outputDir)) {
    await fs.promises.rm(outputDir, { recursive: true, force: true });
    logger.info(`Cleaned up output for job ${jobId}`);
  }
}

export async function cleanupUpload(filename: string): Promise<void> {
  const filePath = path.join(config.UPLOAD_DIR, filename);
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}

export async function getFileInfo(filePath: string): Promise<{ size: number; exists: boolean }> {
  try {
    const stat = await fs.promises.stat(filePath);
    return { size: stat.size, exists: true };
  } catch {
    return { size: 0, exists: false };
  }
}
