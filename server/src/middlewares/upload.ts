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

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // Allow video files
  if (allowedVideoMimes.includes(file.mimetype)) {
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

  cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: video, image, and subtitle files.`));
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
