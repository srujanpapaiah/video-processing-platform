import { Router } from "express";
import { uploadVideo, uploadMultiple } from "../middlewares/upload";
import * as jobsController from "../controllers/jobs.controller";

const router = Router();

// Upload a file (returns filename for later use in job creation)
router.post("/upload", uploadVideo.single("file"), jobsController.uploadFile);

// Upload multiple files (for merge, etc.)
router.post("/upload-multiple", uploadMultiple.array("files", 20), jobsController.uploadMultipleFiles);

// Create a job with file upload in one step
router.post("/", uploadVideo.single("file"), jobsController.createJob);

// Create a job from a previously uploaded file
router.post("/from-upload", jobsController.createJobFromUpload);

// List all jobs
router.get("/", jobsController.listJobs);

// Get a single job
router.get("/:id", jobsController.getJob);

// Probe input video metadata
router.get("/:id/probe", jobsController.probeJob);

// Retry a failed job
router.post("/:id/retry", jobsController.retryJob);

// Cancel a job
router.post("/:id/cancel", jobsController.cancelJobHandler);

// Delete a job and its files
router.delete("/:id", jobsController.deleteJob);

export default router;
