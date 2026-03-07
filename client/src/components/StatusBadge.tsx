import React from "react";

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  waiting: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Waiting" },
  active: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "Processing" },
  completed: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Completed" },
  failed: { bg: "bg-red-500/20", text: "text-red-400", label: "Failed" },
  delayed: { bg: "bg-purple-500/20", text: "text-purple-400", label: "Delayed" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.waiting;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "active" ? "animate-pulse" : ""} ${config.text.replace("text-", "bg-")}`} />
      {config.label}
    </span>
  );
}
