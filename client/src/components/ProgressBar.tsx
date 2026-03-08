import React from "react";

interface ProgressBarProps {
  progress: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  color?: string;
}

export function ProgressBar({
  progress,
  showLabel = true,
  size = "md",
  color = "bg-blue-500",
}: ProgressBarProps) {
  const clamped = Math.min(Math.max(progress, 0), 100);
  const heights = { sm: "h-1.5", md: "h-2.5", lg: "h-4" };

  return (
    <div className="flex items-center gap-3 w-full">
      <div className={`flex-1 bg-dark-700 rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`${color} ${heights[size]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-medium text-dark-300 w-12 text-right">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}
