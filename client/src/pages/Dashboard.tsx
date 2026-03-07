import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { useQueueStats, useJobEvents, useJobProgress } from "../hooks/useSocket";
import { getJobs } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { ProgressBar } from "../components/ProgressBar";
import { formatRelativeTime } from "../lib/utils";
import {
  OPERATION_LABELS,
  SerializedJob,
  JobOperation,
} from "../types";

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...`;
}

function ActiveJobRow({ job }: { job: SerializedJob }) {
  const { progress } = useJobProgress(job.id);
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/jobs/${job.id}`)}
      className="flex items-center justify-between p-4 bg-dark-800 border border-dark-700 rounded-lg hover:bg-dark-700 cursor-pointer transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-dark-100 font-medium truncate">
          {job.originalFilename || job.inputFile}
        </p>
        <p className="text-dark-400 text-sm mt-0.5">
          {OPERATION_LABELS[job.operation as JobOperation] || job.operation}
        </p>
      </div>
      <div className="w-48 ml-4">
        <ProgressBar progress={progress} size="sm" color="bg-yellow-500" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const stats = useQueueStats();
  const [recentJobs, setRecentJobs] = useState<SerializedJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentJobs = useCallback(async () => {
    try {
      const { jobs } = await getJobs({ limit: 10 });
      setRecentJobs(jobs || []);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentJobs();
  }, [fetchRecentJobs]);

  const jobEventCallbacks = useMemo(
    () => ({
      onCompleted: fetchRecentJobs,
      onFailed: fetchRecentJobs,
    }),
    [fetchRecentJobs]
  );
  useJobEvents(jobEventCallbacks);

  const activeJobs = recentJobs.filter((j) => j.status === "active");
  const queueCards: { label: string; count: number; icon: React.ReactNode; color: string }[] = [
    { label: "Waiting", count: stats.waiting, icon: <Clock className="w-5 h-5" />, color: "text-blue-400" },
    { label: "Active", count: stats.active, icon: <Activity className="w-5 h-5" />, color: "text-yellow-400" },
    { label: "Completed", count: stats.completed, icon: <CheckCircle className="w-5 h-5" />, color: "text-emerald-400" },
    { label: "Failed", count: stats.failed, icon: <XCircle className="w-5 h-5" />, color: "text-red-400" },
  ];

  return (
    <div className="min-h-screen bg-dark-950 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-dark-100">Dashboard</h1>
          <button
            onClick={() => {
              setLoading(true);
              fetchRecentJobs();
            }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 hover:bg-dark-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Queue Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {queueCards.map((card) => (
            <div
              key={card.label}
              className="bg-dark-900 border border-dark-700 rounded-xl p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-dark-400 text-sm font-medium">{card.label}</p>
                  <p className="text-2xl font-bold text-dark-100 mt-1">
                    {card.count}
                  </p>
                </div>
                <div className={card.color}>{card.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Active Jobs Section */}
        {activeJobs.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-dark-100 mb-4">
              Active Jobs
            </h2>
            <div className="space-y-3">
              {activeJobs.map((job) => (
                <ActiveJobRow key={job.id} job={job} />
              ))}
            </div>
          </section>
        )}

        {/* Recent Jobs Table */}
        <section>
          <h2 className="text-lg font-semibold text-dark-100 mb-4">
            Recent Jobs
          </h2>
          <div className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-dark-400">
                Loading...
              </div>
            ) : recentJobs.length === 0 ? (
              <div className="p-8 text-center text-dark-400">
                No jobs yet
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left py-3 px-4 text-dark-400 font-medium text-sm">
                      ID
                    </th>
                    <th className="text-left py-3 px-4 text-dark-400 font-medium text-sm">
                      Operation
                    </th>
                    <th className="text-left py-3 px-4 text-dark-400 font-medium text-sm">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-dark-400 font-medium text-sm">
                      Progress
                    </th>
                    <th className="text-left py-3 px-4 text-dark-400 font-medium text-sm">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job) => (
                    <tr
                      key={job.id}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className="border-b border-dark-700 last:border-0 hover:bg-dark-800 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 text-dark-100 font-mono text-sm">
                        {truncateId(job.id)}
                      </td>
                      <td className="py-3 px-4 text-dark-100">
                        {OPERATION_LABELS[job.operation as JobOperation] ||
                          job.operation}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="py-3 px-4">
                        <ProgressBar
                          progress={job.progress}
                          size="sm"
                          showLabel={true}
                        />
                      </td>
                      <td className="py-3 px-4 text-dark-300 text-sm">
                        {formatRelativeTime(job.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
