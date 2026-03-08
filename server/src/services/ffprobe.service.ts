import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import { VideoMetadata } from "../types";
import config from "../config";
import logger from "../utils/logger";

// Use system ffmpeg/ffprobe
if (config.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(config.FFMPEG_PATH);
}
if (config.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(config.FFPROBE_PATH);
}

export async function getVideoMetadata(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        logger.error(`FFprobe error for ${filePath}:`, err);
        return reject(new Error(`Failed to probe video: ${err.message}`));
      }

      const videoStream = data.streams.find((s) => s.codec_type === "video");
      const audioStream = data.streams.find((s) => s.codec_type === "audio");
      const format = data.format;

      const stat = fs.statSync(filePath);

      const metadata: VideoMetadata = {
        filename: path.basename(filePath),
        format: format.format_name || "unknown",
        duration: parseFloat(String(format.duration ?? "0")) || 0,
        size: stat.size,
        bitrate: parseInt(String(format.bit_rate ?? "0")) || 0,
      };

      if (videoStream) {
        const fpsStr = videoStream.r_frame_rate || "0/1";
        const [num, den] = fpsStr.split("/").map(Number);
        const fps = den ? Math.round((num / den) * 100) / 100 : 0;

        metadata.video = {
          codec: videoStream.codec_name || "unknown",
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          fps,
          bitrate: parseInt(String(videoStream.bit_rate ?? "0")) || 0,
        };
      }

      if (audioStream) {
        metadata.audio = {
          codec: audioStream.codec_name || "unknown",
          channels: audioStream.channels || 0,
          sampleRate: parseInt(String(audioStream.sample_rate ?? "0")) || 0,
          bitrate: parseInt(String(audioStream.bit_rate ?? "0")) || 0,
        };
      }

      resolve(metadata);
    });
  });
}
