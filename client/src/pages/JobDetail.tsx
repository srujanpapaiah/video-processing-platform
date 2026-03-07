import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Play,
  RotateCcw,
  XCircle,
  Trash2,
  FileVideo,
  Clock,
  Cpu,
} from "lucide-react";
import {
  getJob,
  retryJob,
  cancelJob,
  deleteJob,
  getJobFiles,
  getFileDownloadUrl,
} from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { ProgressBar } from "../components/ProgressBar";
import { useJobProgress } from "../hooks/useSocket";
import { formatBytes, formatTime, formatDuration } from "../lib/utils";
import {
  OPERATION_LABELS,
  SerializedJob,
  OutputFileInfo,
  JobOperation,
} from "../types";

function isVideoFile(mimeType: string, filename: string): boolean {
  const videoMimes = ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-matroska"];
  const videoExts = [".mp4", ".webm", ".ogg", ".mov", ".mkv", ".m3u8"];
  if (videoMimes.some((m) => mimeType?.toLowerCase().includes(m))) return true;
  return videoExts.some((ext) => filename?.toLowerCase().endsWith(ext));
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<SerializedJob | null>(null);
  const [outputFiles, setOutputFiles] = useState<OutputFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { progress, speed, timemark } = useJobProgress(id);

  const fetchJob = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await getJob(id);
      setJob(data);
      if (data?.result?.outputFiles?.length) {
        setOutputFiles(data.result.outputFiles);
      } else if (data?.status === "completed") {
        try {
          const filesData = await getJobFiles(id);
          setOutputFiles(filesData?.files ?? filesData ?? []);
        } catch {
          setOutputFiles([]);
        }
      } else {
        setOutputFiles([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load job");
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  useEffect(() => {
    if (!id || !job) return;
    const isActive = job.status === "active" || job.status === "waiting" || job.status === "delayed";
    if (!isActive) return;
    const interval = setInterval(fetchJob, 2000);
    return () => clearInterval(interval);
  }, [id, job?.status, fetchJob]);

  const handleRetry = async () => {
    if (!id) return;
    setActionLoading("retry");
    try {
      await retryJob(id);
      await fetchJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    setActionLoading("cancel");
    try {
      await cancelJob(id);
      await fetchJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setActionLoading("delete");
    try {
      await deleteJob(id);
      navigate("/jobs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setActionLoading(null);
    }
  };

  const displayProgress = job?.status === "active" ? progress : job?.progress ?? 0;
  const canRetry = job?.status === "failed";
  const canCancel = job?.status === "active" || job?.status === "waiting" || job?.status === "delayed";

  if (loading && !job) {
    return (
      <div className="min-h-screen bg-dark-950 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-8 text-center text-dark-400">Loading job...</div>
        </div>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="min-h-screen bg-dark-950 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">
            {error}
          </div>
          <button
            onClick={() => navigate("/jobs")}
            className="mt-4 flex items-center gap-2 text-dark-300 hover:text-dark-100"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="min-h-screen bg-dark-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg bg-dark-800 border border-dark-700 hover:bg-dark-700 text-dark-300 hover:text-dark-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-dark-100 font-mono">{job.id}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="px-2.5 py-1 rounded-lg bg-dark-700 text-dark-300 text-sm font-medium">
                  {OPERATION_LABELS[job.operation as JobOperation] || job.operation}
                </span>
                <StatusBadge status={job.status} />
                <span className="flex items-center gap-1.5 text-dark-400 text-sm">
                  <Clock className="w-4 h-4" />
                  {formatTime(job.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        {(job.status === "active" || job.status === "completed") && (
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
            <h2 className="text-sm font-medium text-dark-400 uppercase tracking-wider mb-4">
              Progress
            </h2>
            <div className="space-y-3">
              <ProgressBar
                progress={displayProgress}
                size="lg"
                color={job.status === "completed" ? "bg-emerald-500" : "bg-yellow-500"}
              />
              {(speed || timemark) && job.status === "active" && (
                <div className="flex items-center gap-4 text-sm text-dark-300">
                  {speed && (
                    <span className="flex items-center gap-1.5">
                      <Cpu className="w-4 h-4" />
                      {speed}
                    </span>
                  )}
                  {timemark && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {timemark}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input Info */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <h2 className="text-sm font-medium text-dark-400 uppercase tracking-wider mb-4">
            Input
          </h2>
          <div className="space-y-2">
            <p className="text-dark-100 font-medium">{job.originalFilename || job.inputFile}</p>
            {job.result?.duration != null && (
              <p className="text-dark-400 text-sm">
                Duration: {formatDuration(job.result.duration)}
              </p>
            )}
          </div>
        </div>

        {/* Output Files */}
        {outputFiles.length > 0 && (
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
            <h2 className="text-sm font-medium text-dark-400 uppercase tracking-wider mb-4">
              Output Files
            </h2>
            <div className="space-y-3">
              {outputFiles.map((file) => {
                const downloadUrl = getFileDownloadUrl(id!, file.filename);
                const isVideo = isVideoFile(file.mimeType || "", file.filename);
                return (
                  <div
                    key={file.filename}
                    className="flex items-center justify-between p-4 bg-dark-800 border border-dark-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileVideo className="w-5 h-5 text-dark-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-dark-100 font-medium truncate">{file.filename}</p>
                        <p className="text-dark-400 text-sm">{formatBytes(file.size || 0)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={downloadUrl}
                        download={file.filename}
                        className="flex items-center gap-2 px-3 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-dark-200 text-sm font-medium transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                      {isVideo && (
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-dark-200 text-sm font-medium transition-colors"
                        >
                          <Play className="w-4 h-4" />
                          Preview
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Processing Details */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <h2 className="text-sm font-medium text-dark-400 uppercase tracking-wider mb-4">
            Processing Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-dark-400">Attempts</p>
              <p className="text-dark-100 font-medium mt-0.5">{job.attemptsMade ?? 0}</p>
            </div>
            {job.processedAt != null && (
              <div>
                <p className="text-dark-400">Processed At</p>
                <p className="text-dark-100 font-medium mt-0.5">{formatTime(job.processedAt)}</p>
              </div>
            )}
            {job.finishedAt != null && (
              <div>
                <p className="text-dark-400">Finished At</p>
                <p className="text-dark-100 font-medium mt-0.5">{formatTime(job.finishedAt)}</p>
              </div>
            )}
            {job.failedReason && (
              <div className="sm:col-span-2">
                <p className="text-dark-400">Failed Reason</p>
                <p className="text-red-400 font-medium mt-0.5">{job.failedReason}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {canRetry && (
            <button
              onClick={handleRetry}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
            >
              <RotateCcw className={`w-4 h-4 ${actionLoading === "retry" ? "animate-spin" : ""}`} />
              Retry
            </button>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
            >
              <XCircle className={`w-4 h-4 ${actionLoading === "cancel" ? "animate-spin" : ""}`} />
              Cancel
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={!!actionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 disabled:opacity-50 rounded-lg text-red-400 font-medium transition-colors"
          >
            <Trash2 className={`w-4 h-4 ${actionLoading === "delete" ? "animate-spin" : ""}`} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
