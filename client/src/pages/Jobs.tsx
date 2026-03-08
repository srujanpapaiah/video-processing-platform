import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getJobs,
  retryJob,
  cancelJob,
  deleteJob,
} from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { ProgressBar } from "../components/ProgressBar";
import { formatRelativeTime } from "../lib/utils";
import { OPERATION_LABELS, SerializedJob, JobOperation } from "../types";
import { useJobEvents } from "../hooks/useSocket";
import {
  RefreshCw,
  Eye,
  RotateCcw,
  XCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "waiting", label: "Waiting" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

const OPERATION_OPTIONS = [
  { value: "all", label: "All" },
  ...Object.entries(OPERATION_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

const LIMIT = 20;

export default function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<SerializedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [operationFilter, setOperationFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await getJobs({
        page,
        limit: LIMIT,
        status: statusFilter === "all" ? undefined : statusFilter,
        operation: operationFilter === "all" ? undefined : operationFilter,
      });
      setJobs(res.jobs || []);
      setTotalPages(res.totalPages ?? 1);
      setTotal(res.total ?? 0);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [page, statusFilter, operationFilter]);

  useJobEvents({
    onActive: () => fetchJobs(),
    onCompleted: () => fetchJobs(),
    onFailed: () => fetchJobs(),
  });

  const handleRetry = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActionLoading(id);
    try {
      await retryJob(id);
      await fetchJobs();
    } catch (err) {
      console.error("Retry failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActionLoading(id);
    try {
      await cancelJob(id);
      await fetchJobs();
    } catch (err) {
      console.error("Cancel failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActionLoading(id);
    try {
      await deleteJob(id);
      await fetchJobs();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const truncateId = (id: string) => id.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-dark-100">Jobs</h1>
        <button
          onClick={() => fetchJobs()}
          disabled={loading}
          className="btn-secondary"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="label">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="select w-40"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Operation</label>
          <select
            value={operationFilter}
            onChange={(e) => {
              setOperationFilter(e.target.value);
              setPage(1);
            }}
            className="select w-48"
          >
            {OPERATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-dark-800 text-dark-400 text-xs uppercase">
                <th className="text-left px-4 py-3 font-medium">ID</th>
                <th className="text-left px-4 py-3 font-medium">Operation</th>
                <th className="text-left px-4 py-3 font-medium">Original Filename</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium w-48">Progress</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-dark-400">
                    Loading...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-dark-400">
                    No jobs found
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="border-t border-dark-800 hover:bg-dark-800/50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-dark-300 font-mono text-sm">
                      {truncateId(job.id)}
                    </td>
                    <td className="px-4 py-3 text-dark-200">
                      {OPERATION_LABELS[job.operation as JobOperation] ?? job.operation}
                    </td>
                    <td className="px-4 py-3 text-dark-200 truncate max-w-[200px]">
                      {job.originalFilename}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ProgressBar
                        progress={job.progress}
                        showLabel={true}
                        size="sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-dark-400 text-sm">
                      {formatRelativeTime(job.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => navigate(`/jobs/${job.id}`)}
                          className="btn-secondary !px-2 !py-1.5 text-sm"
                          title="View detail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {job.status === "failed" && (
                          <button
                            onClick={(e) => handleRetry(e, job.id)}
                            disabled={actionLoading === job.id}
                            className="btn-secondary !px-2 !py-1.5 text-sm"
                            title="Retry"
                          >
                            <RotateCcw
                              className={`w-4 h-4 ${actionLoading === job.id ? "animate-spin" : ""}`}
                            />
                          </button>
                        )}
                        {(job.status === "active" || job.status === "waiting") && (
                          <button
                            onClick={(e) => handleCancel(e, job.id)}
                            disabled={actionLoading === job.id}
                            className="btn-danger !px-2 !py-1.5 text-sm"
                            title="Cancel"
                          >
                            <XCircle
                              className={`w-4 h-4 ${actionLoading === job.id ? "animate-spin" : ""}`}
                            />
                          </button>
                        )}
                        {job.status === "completed" && (
                          <button
                            onClick={(e) => handleDelete(e, job.id)}
                            disabled={actionLoading === job.id}
                            className="btn-danger !px-2 !py-1.5 text-sm"
                            title="Delete"
                          >
                            <Trash2
                              className={`w-4 h-4 ${actionLoading === job.id ? "animate-spin" : ""}`}
                            />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-800 bg-dark-800/30">
            <span className="text-sm text-dark-400">
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary !px-2 !py-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) {
                    p = i + 1;
                  } else if (page <= 3) {
                    p = i + 1;
                  } else if (page >= totalPages - 2) {
                    p = totalPages - 4 + i;
                  } else {
                    p = page - 2 + i;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`!px-3 !py-1.5 rounded-lg text-sm font-medium ${
                        p === page
                          ? "bg-blue-600 text-white"
                          : "bg-dark-700 text-dark-300 hover:bg-dark-600"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-secondary !px-2 !py-1.5"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
