import { z } from "zod";

export const compressOptionsSchema = z.object({
  codec: z.enum(["h264", "h265", "vp9", "av1"]).default("h264"),
  crf: z.number().min(0).max(51).default(23),
  preset: z.enum([
    "ultrafast", "superfast", "veryfast", "faster", "fast",
    "medium", "slow", "slower", "veryslow",
  ]).default("medium"),
  audioBitrate: z.string().default("128k"),
});

export const transcodeOptionsSchema = z.object({
  format: z.enum(["mp4", "webm", "mkv", "avi", "mov", "flv", "ogg"]),
  videoCodec: z.string().optional(),
  audioCodec: z.string().optional(),
  copyMode: z.boolean().default(false),
});

const resolutionSchema = z.object({
  name: z.string(),
  width: z.number().positive(),
  height: z.number().positive(),
  bitrate: z.string(),
});

export const hlsOptionsSchema = z.object({
  resolutions: z.array(resolutionSchema).default([
    { name: "1080p", width: 1920, height: 1080, bitrate: "5000k" },
    { name: "720p", width: 1280, height: 720, bitrate: "2800k" },
    { name: "480p", width: 854, height: 480, bitrate: "1400k" },
    { name: "360p", width: 640, height: 360, bitrate: "800k" },
  ]),
  segmentDuration: z.number().min(1).max(30).default(6),
});

export const dashOptionsSchema = z.object({
  resolutions: z.array(resolutionSchema).default([
    { name: "1080p", width: 1920, height: 1080, bitrate: "5000k" },
    { name: "720p", width: 1280, height: 720, bitrate: "2800k" },
    { name: "480p", width: 854, height: 480, bitrate: "1400k" },
    { name: "360p", width: 640, height: 360, bitrate: "800k" },
  ]),
  segmentDuration: z.number().min(1).max(30).default(4),
});

export const thumbnailOptionsSchema = z.object({
  mode: z.enum(["single", "grid", "interval"]).default("single"),
  timestamp: z.string().default("00:00:01"),
  interval: z.number().min(1).optional(),
  count: z.number().min(1).max(100).default(1),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  columns: z.number().min(1).max(10).default(4),
});

export const trimOptionsSchema = z.object({
  startTime: z.string(),
  endTime: z.string().optional(),
  duration: z.string().optional(),
  copyMode: z.boolean().default(true),
});

export const resizeOptionsSchema = z.object({
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  maintainAspectRatio: z.boolean().default(true),
}).refine((data) => data.width || data.height, {
  message: "At least one of width or height must be provided",
});

export const watermarkOptionsSchema = z.object({
  type: z.enum(["image", "text"]),
  imagePath: z.string().optional(),
  text: z.string().optional(),
  fontSize: z.number().min(8).max(200).default(24),
  fontColor: z.string().default("white"),
  position: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"]).default("bottom-right"),
  opacity: z.number().min(0).max(1).default(0.8),
});

export const extractAudioOptionsSchema = z.object({
  format: z.enum(["mp3", "aac", "wav", "flac", "ogg"]).default("mp3"),
  bitrate: z.string().default("192k"),
  sampleRate: z.number().optional(),
});

export const gifOptionsSchema = z.object({
  startTime: z.string().default("00:00:00"),
  duration: z.string().default("5"),
  fps: z.number().min(1).max(30).default(10),
  width: z.number().positive().default(480),
  height: z.number().positive().optional(),
});

export const mergeOptionsSchema = z.object({
  // inputFiles will be populated from uploaded files
  transition: z.boolean().default(false),
});

export const addSubtitlesOptionsSchema = z.object({
  subtitleFile: z.string().optional(), // populated from upload
  burnIn: z.boolean().default(true),
});

// Main job creation schema (used for request body parsing)
export const createJobSchema = z.object({
  operation: z.enum([
    "compress", "transcode", "hls", "dash", "thumbnail",
    "trim", "resize", "watermark", "extract-audio", "gif",
    "merge", "add-subtitles",
  ]),
  options: z.record(z.unknown()).default({}),
});

export const jobListQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(["waiting", "active", "completed", "failed", "delayed", "all"]).default("all"),
  operation: z.string().optional(),
});
