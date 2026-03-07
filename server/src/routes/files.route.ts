import { Router } from "express";
import * as filesController from "../controllers/files.controller";

const router = Router();

// List output files for a job
router.get("/:jobId", filesController.listJobFiles);

// Stream/download an uploaded file (for preview)
router.get("/uploads/:filename", filesController.streamUploadedFile);

// Download a specific output file (supports nested paths)
router.get("/:jobId/*", filesController.downloadFile);

export default router;
