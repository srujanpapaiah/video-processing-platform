import os from "os";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { DirStats, SystemStats } from "../types";
import config from "../config";
import logger from "./logger";

export function getCpuUsage(): number {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  }

  return Math.round((1 - totalIdle / totalTick) * 100);
}

export function getMemoryStats() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    total,
    used,
    free,
    usage: Math.round((used / total) * 100),
  };
}

async function getDirStats(dirPath: string): Promise<DirStats> {
  try {
    if (!fs.existsSync(dirPath)) {
      return { path: dirPath, size: 0, fileCount: 0 };
    }

    let totalSize = 0;
    let fileCount = 0;

    const walkDir = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else {
          const stat = await fs.promises.stat(fullPath);
          totalSize += stat.size;
          fileCount++;
        }
      }
    };

    await walkDir(dirPath);
    return { path: dirPath, size: totalSize, fileCount };
  } catch {
    return { path: dirPath, size: 0, fileCount: 0 };
  }
}

function getFFmpegVersion(): string {
  try {
    const output = execSync("ffmpeg -version 2>&1", { timeout: 5000 }).toString();
    const match = output.match(/ffmpeg version (\S+)/);
    return match ? match[1] : "unknown";
  } catch {
    return "not found";
  }
}

let cachedFFmpegVersion: string | null = null;

export async function getSystemStats(): Promise<SystemStats> {
  if (!cachedFFmpegVersion) {
    cachedFFmpegVersion = getFFmpegVersion();
  }

  const [uploadDir, outputDir] = await Promise.all([
    getDirStats(config.UPLOAD_DIR),
    getDirStats(config.OUTPUT_DIR),
  ]);

  return {
    cpu: {
      usage: getCpuUsage(),
      cores: os.cpus().length,
      model: os.cpus()[0]?.model || "unknown",
    },
    memory: getMemoryStats(),
    disk: {
      uploadDir,
      outputDir,
    },
    uptime: process.uptime(),
    platform: `${os.platform()} ${os.release()}`,
    nodeVersion: process.version,
    ffmpegVersion: cachedFFmpegVersion,
  };
}
