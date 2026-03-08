// ─── Job Types ───────────────────────────────────────────────────────────────

export const JobOperation = {
  COMPRESS: "compress",
  TRANSCODE: "transcode",
  HLS: "hls",
  DASH: "dash",
  THUMBNAIL: "thumbnail",
  TRIM: "trim",
  RESIZE: "resize",
  WATERMARK: "watermark",
  EXTRACT_AUDIO: "extract-audio",
  GIF: "gif",
  MERGE: "merge",
  ADD_SUBTITLES: "add-subtitles",
} as const;

export type JobOperation = (typeof JobOperation)[keyof typeof JobOperation];

export const JobStatus = {
  WAITING: "waiting",
  ACTIVE: "active",
  COMPLETED: "completed",
  FAILED: "failed",
  DELAYED: "delayed",
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

// ─── FFmpeg Options ──────────────────────────────────────────────────────────

export interface CompressOptions {
  codec?: "h264" | "h265" | "vp9" | "av1";
  crf?: number; // 0-51, default 23
  preset?: "ultrafast" | "superfast" | "veryfast" | "faster" | "fast" | "medium" | "slow" | "slower" | "veryslow";
  audioBitrate?: string;
}

export interface TranscodeOptions {
  format: "mp4" | "webm" | "mkv" | "avi" | "mov" | "flv" | "ogg";
  videoCodec?: string;
  audioCodec?: string;
  copyMode?: boolean;
}

export interface HLSOptions {
  resolutions?: { name: string; width: number; height: number; bitrate: string }[];
  segmentDuration?: number;
}

export interface DASHOptions {
  resolutions?: { name: string; width: number; height: number; bitrate: string }[];
  segmentDuration?: number;
}

export interface ThumbnailOptions {
  mode: "single" | "grid" | "interval";
  timestamp?: string;    // for single mode, e.g. "00:00:05"
  interval?: number;     // for interval mode, seconds between thumbnails
  count?: number;        // for grid mode, total thumbnails
  width?: number;
  height?: number;
  columns?: number;      // for grid mode
}

export interface TrimOptions {
  startTime: string;     // HH:MM:SS or seconds
  endTime?: string;
  duration?: string;
  copyMode?: boolean;    // fast copy vs re-encode
}

export interface ResizeOptions {
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
}

export interface WatermarkOptions {
  type: "image" | "text";
  // Image watermark
  imagePath?: string;
  // Text watermark
  text?: string;
  fontSize?: number;
  fontColor?: string;
  // Common
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  opacity?: number;      // 0.0 - 1.0
}

export interface ExtractAudioOptions {
  format: "mp3" | "aac" | "wav" | "flac" | "ogg";
  bitrate?: string;
  sampleRate?: number;
}

export interface GifOptions {
  startTime?: string;
  duration?: string;
  fps?: number;
  width?: number;
  height?: number;
}

export interface MergeOptions {
  inputFiles: string[];
  transition?: boolean;
}

export interface AddSubtitlesOptions {
  subtitleFile: string;
  burnIn?: boolean;     // true = hardcode, false = soft subs
}

// ─── Job Data ────────────────────────────────────────────────────────────────

export interface JobData {
  operation: JobOperation;
  inputFile: string;
  originalFilename: string;
  options: Record<string, unknown>;
}

export interface JobResult {
  outputFiles: OutputFileInfo[];
  duration: number; // processing time in ms
  metadata?: VideoMetadata;
}

export interface OutputFileInfo {
  filename: string;
  path: string;
  size: number;
  mimeType: string;
}

// ─── Video Metadata ──────────────────────────────────────────────────────────

export interface VideoMetadata {
  filename: string;
  format: string;
  duration: number;        // seconds
  size: number;            // bytes
  bitrate: number;         // bps
  video?: {
    codec: string;
    width: number;
    height: number;
    fps: number;
    bitrate: number;
  };
  audio?: {
    codec: string;
    channels: number;
    sampleRate: number;
    bitrate: number;
  };
}

// ─── Progress ────────────────────────────────────────────────────────────────

export interface FFmpegProgress {
  percent: number;
  frames?: number;
  currentFps?: number;
  currentKbps?: number;
  targetSize?: number;
  timemark?: string;
  speed?: string;
}

// ─── Queue Stats ─────────────────────────────────────────────────────────────

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// ─── System Stats ────────────────────────────────────────────────────────────

export interface SystemStats {
  cpu: {
    usage: number;         // percentage
    cores: number;
    model: string;
  };
  memory: {
    total: number;         // bytes
    used: number;
    free: number;
    usage: number;         // percentage
  };
  disk: {
    uploadDir: DirStats;
    outputDir: DirStats;
  };
  uptime: number;          // seconds
  platform: string;
  nodeVersion: string;
  ffmpegVersion: string;
}

export interface DirStats {
  path: string;
  size: number;            // bytes
  fileCount: number;
}

// ─── API Response ────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Serialized Job ──────────────────────────────────────────────────────────

export interface SerializedJob {
  id: string;
  operation: JobOperation;
  status: string;
  progress: number;
  inputFile: string;
  originalFilename: string;
  options: Record<string, unknown>;
  result?: JobResult;
  failedReason?: string;
  createdAt: number;
  processedAt?: number;
  finishedAt?: number;
  attemptsMade: number;
  logs?: string[];
}
