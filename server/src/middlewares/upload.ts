import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import config from "../config";
import fs from "fs";

// Ensure upload directory exists
if (!fs.existsSync(config.UPLOAD_DIR)) {
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${uuidv4()}${ext}`;
    cb(null, name);
  },
});

const allowedVideoMimes = [
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/webm",
  "video/x-flv",
  "video/ogg",
  "video/3gpp",
  "video/3gpp2",
  "video/x-ms-wmv",
];

const allowedSubtitleExts = [".srt", ".ass", ".ssa", ".vtt"];

const allowedVideoExts = [
  ".mp4", ".mpeg", ".mpg", ".mov", ".avi", ".mkv", ".webm",
  ".flv", ".ogg", ".ogv", ".3gp", ".3g2", ".wmv", ".m4v",
];

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // Allow video files by MIME type
  if (allowedVideoMimes.includes(file.mimetype)) {
    return cb(null, true);
  }

  // Allow video files by extension (for tools that send application/octet-stream)
  if (allowedVideoExts.includes(ext)) {
    return cb(null, true);
  }

  // Allow subtitle files
  if (allowedSubtitleExts.includes(ext)) {
    return cb(null, true);
  }

  // Allow image files (for watermark)
  if (file.mimetype.startsWith("image/")) {
    return cb(null, true);
  }

  // Allow application/octet-stream if extension looks like video
  if (file.mimetype === "application/octet-stream" && (allowedVideoExts.includes(ext) || allowedSubtitleExts.includes(ext))) {
    return cb(null, true);
  }

  cb(new Error(`Invalid file type: ${file.mimetype} (${ext}). Allowed: video, image, and subtitle files.`));
};

export const uploadVideo = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.MAX_FILE_SIZE_BYTES,
  },
});

export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.MAX_FILE_SIZE_BYTES,
    files: 20,
  },
});
