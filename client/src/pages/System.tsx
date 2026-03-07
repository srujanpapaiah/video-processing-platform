import { useState, useEffect } from "react";
import { Cpu, HardDrive, MemoryStick, Server, Activity } from "lucide-react";
import { getStats } from "../lib/api";
import { useQueueStats } from "../hooks/useSocket";
import { formatBytes, formatUptime } from "../lib/utils";
import { SystemStats } from "../types";

function GaugeBar({
  value,
  max,
  color = "bg-blue-500",
  label,
}: {
  value: number;
  max: number;
  color?: string;
  label: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-dark-400">{label}</span>
        <span className="text-dark-200 font-medium">{Math.round(pct)}%</span>
      </div>
      <div className="h-2.5 bg-dark-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CircularGauge({ value, label, color = "text-blue-400" }: { value: number; label: string; color?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-dark-700"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={`${color} transition-all duration-500`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold ${color}`}>{Math.round(pct)}%</span>
        <span className="text-xs text-dark-400">{label}</span>
      </div>
    </div>
  );
}

export default function System() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queueStats = useQueueStats();

  const fetchStats = async () => {
    try {
      setError(null);
      const data = await getStats();
      // getStats returns { queue, system } — we want the system stats
      setStats(data?.system ?? data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-dark-950 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="p-8 text-center text-dark-400">Loading system stats...</div>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="min-h-screen bg-dark-950 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-dark-100">System Monitor</h1>

        {/* CPU & Memory Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-medium text-dark-400 uppercase tracking-wider">
                CPU Usage
              </h2>
            </div>
            <div className="flex justify-center">
              <CircularGauge
                value={stats?.cpu?.usage ?? 0}
                label="Usage"
                color="text-blue-400"
              />
            </div>
            {stats?.cpu?.model && (
              <p className="text-dark-400 text-sm mt-4 text-center truncate">
                {stats.cpu.model}
              </p>
            )}
            {stats?.cpu?.cores != null && (
              <p className="text-dark-400 text-sm text-center">{stats.cpu.cores} cores</p>
            )}
          </div>

          <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <MemoryStick className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-medium text-dark-400 uppercase tracking-wider">
                Memory
              </h2>
            </div>
            <div className="space-y-4">
              <GaugeBar
                value={stats?.memory?.used ?? 0}
                max={stats?.memory?.total ?? 1}
                color="bg-emerald-500"
                label="Used"
              />
              <div className="flex justify-between text-sm text-dark-400">
                <span>Total: {formatBytes(stats?.memory?.total ?? 0)}</span>
                <span>Free: {formatBytes(stats?.memory?.free ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Disk Usage */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-medium text-dark-400 uppercase tracking-wider">
              Disk Usage
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-dark-800 border border-dark-700 rounded-lg">
              <p className="text-dark-400 text-sm mb-1">Upload Directory</p>
              <p className="text-dark-100 font-medium truncate">
                {stats?.disk?.uploadDir?.path ?? "—"}
              </p>
              <p className="text-dark-300 text-sm mt-2">
                {formatBytes(stats?.disk?.uploadDir?.size ?? 0)} •{" "}
                {stats?.disk?.uploadDir?.fileCount ?? 0} files
              </p>
            </div>
            <div className="p-4 bg-dark-800 border border-dark-700 rounded-lg">
              <p className="text-dark-400 text-sm mb-1">Output Directory</p>
              <p className="text-dark-100 font-medium truncate">
                {stats?.disk?.outputDir?.path ?? "—"}
              </p>
              <p className="text-dark-300 text-sm mt-2">
                {formatBytes(stats?.disk?.outputDir?.size ?? 0)} •{" "}
                {stats?.disk?.outputDir?.fileCount ?? 0} files
              </p>
            </div>
          </div>
        </div>

        {/* Queue Health */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-medium text-dark-400 uppercase tracking-wider">
              Queue Health
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-dark-800 border border-dark-700 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-400">{queueStats.waiting}</p>
              <p className="text-dark-400 text-sm mt-1">Waiting</p>
            </div>
            <div className="p-4 bg-dark-800 border border-dark-700 rounded-lg text-center">
              <p className="text-2xl font-bold text-yellow-400">{queueStats.active}</p>
              <p className="text-dark-400 text-sm mt-1">Active</p>
            </div>
            <div className="p-4 bg-dark-800 border border-dark-700 rounded-lg text-center">
              <p className="text-2xl font-bold text-emerald-400">{queueStats.completed}</p>
              <p className="text-dark-400 text-sm mt-1">Completed</p>
            </div>
            <div className="p-4 bg-dark-800 border border-dark-700 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-400">{queueStats.failed}</p>
              <p className="text-dark-400 text-sm mt-1">Failed</p>
            </div>
          </div>
        </div>

        {/* Server Info */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-medium text-dark-400 uppercase tracking-wider">
              Server Info
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-dark-800 border border-dark-700 rounded-lg">
              <p className="text-dark-400 text-sm mb-1">Platform</p>
              <p className="text-dark-100 font-medium">{stats?.platform ?? "—"}</p>
            </div>
            <div className="p-4 bg-dark-800 border border-dark-700 rounded-lg">
              <p className="text-dark-400 text-sm mb-1">Node Version</p>
              <p className="text-dark-100 font-medium">{stats?.nodeVersion ?? "—"}</p>
            </div>
            <div className="p-4 bg-dark-800 border border-dark-700 rounded-lg">
              <p className="text-dark-400 text-sm mb-1">FFmpeg Version</p>
              <p className="text-dark-100 font-medium">{stats?.ffmpegVersion ?? "—"}</p>
            </div>
            <div className="p-4 bg-dark-800 border border-dark-700 rounded-lg">
              <p className="text-dark-400 text-sm mb-1">Uptime</p>
              <p className="text-dark-100 font-medium">
                {stats?.uptime != null ? formatUptime(stats.uptime) : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
