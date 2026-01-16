import ffmpeg from "fluent-ffmpeg";
import DOMPurify from 'dompurify';
import ffmpegStatic from "ffmpeg-static";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import logger from "../utils/logger";

const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);
const FFMPEG_TIMEOUT = 30 * 60 * 1000;

class FFmpegService {
  private readonly localStoragePath: string;

  constructor(localStoragePath: string) {
    if (ffmpegStatic === null) {
      throw new Error("FFmpeg not found. Make sure ffmpeg-static is properly installed.");
    }
    ffmpeg.setFfmpegPath(ffmpegStatic);
    logger.info(`FFmpeg path set to: ${ffmpegStatic}`);

    this.localStoragePath = localStoragePath;
    this.ensureLocalStorageExists();
  }

  private async ensureLocalStorageExists() {
    try {
      await mkdirAsync(this.localStoragePath, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create local storage directory: ${error}`);
      throw error;
    }
  }

  async transcodeVideo(inputFilePath: string, videoId: string): Promise<void> {
    const resolutions = [
      { name: "1080p", width: 1920, height: 1080 },
      { name: "720p", width: 1280, height: 720 },
      { name: "360p", width: 640, height: 360 },
    ];

    const outputDir = path.join(this.localStoragePath, videoId);
    await mkdirAsync(outputDir, { recursive: true });

    try {
      const resolutionPromises = resolutions.map(resolution =>
        this.transcodeResolution(inputFilePath, videoId, resolution, outputDir)
      );

      await Promise.all(resolutionPromises);

      // Create master playlist
      const masterPlaylistContent = this.createMasterPlaylist(resolutions);
      await writeFileAsync(path.join(outputDir, "master.m3u8"), masterPlaylistContent);
      logger.info(`Created master playlist for videoId: ${videoId}`);
    } catch (error) {
      logger.error(`Error transcoding video for videoId ${videoId}:`, error);
      throw error;
    }
  }

  private createMasterPlaylist(resolutions: { name: string; width: number; height: number }[]): string {
    let masterPlaylist = "#EXTM3U\n#EXT-X-VERSION:3\n";

    for (const resolution of resolutions) {
      const bandwidth = resolution.width * resolution.height * 2.5; // This is a simplistic bandwidth calculation
      masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution.width}x${resolution.height}\n`;
      masterPlaylist += `${resolution.name}.m3u8\n`;
    }

    return masterPlaylist;
  }

  private async transcodeResolution(
    inputFilePath: string,
    videoId: string,
    resolution: { name: string; width: number; height: number },
    outputDir: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info(`Starting transcoding for ${resolution.name} resolution`);

      const command = ffmpeg(inputFilePath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .size(`${resolution.width}x${resolution.height}`)
        .outputOptions([
          "-preset", "veryfast",
          "-hls_time", "6",
          "-hls_playlist_type", "vod",
          "-hls_flags", "independent_segments",
          "-hls_segment_type", "mpegts",
          "-f", "hls",
          "-hls_segment_filename", path.join(outputDir, `${resolution.name}_%03d.ts`),
        ])
        .output(path.join(outputDir, `${resolution.name}.m3u8`))
        .on("start", (commandLine) => {
          logger.info(`FFmpeg process started for ${resolution.name}: ${commandLine}`);
        })
        .on("progress", (progress) => {
          logger.info(`FFmpeg progress (${resolution.name}): ${JSON.stringify(progress)}`);
        })
        .on("end", () => {
          logger.info(`Transcoding completed for ${resolution.name} resolution`);
          resolve();
        })
        .on("error", (err, stdout, stderr) => {
          logger.error(`Transcoding ${resolution.name} failed: ${err.message}`);
          logger.error(`FFmpeg stdout: ${stdout}`);
          logger.error(`FFmpeg stderr: ${stderr}`);
          reject(new Error(`Transcoding ${resolution.name} failed: ${err.message}\nStdout: ${stdout}\nStderr: ${stderr}`));
        });

      const timeout = setTimeout(() => {
        command.kill("SIGKILL");
        reject(new Error(`Transcoding ${resolution.name} timed out after ${FFMPEG_TIMEOUT / 60000} minutes`));
      }, FFMPEG_TIMEOUT);

      command.run();

      command.on("end", () => clearTimeout(timeout));
    });
  }
}

export default FFmpegService;