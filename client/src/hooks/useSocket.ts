import { useEffect, useState, useCallback } from "react";
import { getSocket } from "../lib/socket";
import { QueueStats } from "../types";

export function useQueueStats() {
  const [stats, setStats] = useState<QueueStats>({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  });

  useEffect(() => {
    const socket = getSocket();
    const handler = (data: QueueStats) => setStats(data);
    socket.on("queue:stats", handler);
    return () => { socket.off("queue:stats", handler); };
  }, []);

  return stats;
}

export function useJobProgress(jobId?: string) {
  const [progress, setProgress] = useState(0);
  const [details, setDetails] = useState<{
    currentFps?: number;
    speed?: string;
    timemark?: string;
  }>({});

  useEffect(() => {
    if (!jobId) return;

    const socket = getSocket();

    const progressHandler = (data: any) => {
      if (data.jobId === jobId) {
        setProgress(data.progress || 0);
        setDetails({
          currentFps: data.currentFps,
          speed: data.speed,
          timemark: data.timemark,
        });
      }
    };

    const completedHandler = (data: any) => {
      if (data.jobId === jobId) {
        setProgress(100);
      }
    };

    socket.on("job:progress", progressHandler);
    socket.on("job:completed", completedHandler);

    return () => {
      socket.off("job:progress", progressHandler);
      socket.off("job:completed", completedHandler);
    };
  }, [jobId]);

  return { progress, ...details };
}

export function useJobEvents(callbacks?: {
  onActive?: (jobId: string) => void;
  onCompleted?: (jobId: string) => void;
  onFailed?: (jobId: string, error: string) => void;
}) {
  useEffect(() => {
    const socket = getSocket();

    const activeHandler = (data: any) => callbacks?.onActive?.(data.jobId);
    const completedHandler = (data: any) => callbacks?.onCompleted?.(data.jobId);
    const failedHandler = (data: any) => callbacks?.onFailed?.(data.jobId, data.error);

    socket.on("job:active", activeHandler);
    socket.on("job:completed", completedHandler);
    socket.on("job:failed", failedHandler);

    return () => {
      socket.off("job:active", activeHandler);
      socket.off("job:completed", completedHandler);
      socket.off("job:failed", failedHandler);
    };
  }, [callbacks]);
}
