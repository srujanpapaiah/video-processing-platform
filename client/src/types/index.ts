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
}

export interface JobResult {
  outputFiles: OutputFileInfo[];
  duration: number;
}

export interface OutputFileInfo {
  filename: string;
  size: number;
  mimeType: string;
  downloadUrl: string;
}

export interface VideoMetadata {
  filename: string;
  format: string;
  duration: number;
  size: number;
  bitrate: number;
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

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface SystemStats {
  cpu: { usage: number; cores: number; model: string };
  memory: { total: number; used: number; free: number; usage: number };
  disk: {
    uploadDir: { path: string; size: number; fileCount: number };
    outputDir: { path: string; size: number; fileCount: number };
  };
  uptime: number;
  platform: string;
  nodeVersion: string;
  ffmpegVersion: string;
}

export interface UploadResponse {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  metadata?: VideoMetadata;
}

export const OPERATION_LABELS: Record<JobOperation, string> = {
  compress: "Compress",
  transcode: "Transcode",
  hls: "HLS Streaming",
  dash: "DASH Streaming",
  thumbnail: "Thumbnails",
  trim: "Trim / Cut",
  resize: "Resize",
  watermark: "Watermark",
  "extract-audio": "Extract Audio",
  gif: "Create GIF",
  merge: "Merge Videos",
  "add-subtitles": "Add Subtitles",
};

export const OPERATION_DESCRIPTIONS: Record<JobOperation, string> = {
  compress: "Reduce video file size with configurable quality",
  transcode: "Convert between video formats (MP4, WebM, MKV, etc.)",
  hls: "Generate adaptive bitrate HLS streams",
  dash: "Generate MPEG-DASH adaptive streams",
  thumbnail: "Extract thumbnails from video",
  trim: "Cut a segment from the video",
  resize: "Change video resolution",
  watermark: "Add image or text watermark overlay",
  "extract-audio": "Extract audio track from video",
  gif: "Convert video segment to animated GIF",
  merge: "Concatenate multiple videos",
  "add-subtitles": "Burn in or embed subtitles",
};
