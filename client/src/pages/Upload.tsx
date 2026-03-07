import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload as UploadIcon,
  Film,
  Play,
  Settings,
} from "lucide-react";
import { uploadFile, createJobFromUpload, getUploadStreamUrl } from "../lib/api";
import {
  OPERATION_LABELS,
  OPERATION_DESCRIPTIONS,
  JobOperation,
  UploadResponse,
} from "../types";
import { formatBytes } from "../lib/utils";

const OPERATIONS: JobOperation[] = [
  "compress",
  "transcode",
  "hls",
  "dash",
  "thumbnail",
  "trim",
  "resize",
  "watermark",
  "extract-audio",
  "gif",
  "merge",
  "add-subtitles",
];

const DEFAULT_OPTIONS: Record<JobOperation, Record<string, unknown>> = {
  compress: { codec: "h264", crf: 23, preset: "medium", audioBitrate: 128 },
  transcode: { format: "mp4", copyMode: false },
  hls: { segmentDuration: 6 },
  dash: { segmentDuration: 6 },
  thumbnail: { mode: "single", timestamp: 0, count: 1 },
  trim: { startTime: 0, endTime: 60 },
  resize: { width: 1920, height: 1080, maintainAspectRatio: true },
  watermark: {
    type: "text",
    text: "Watermark",
    position: "bottom-right",
    fontSize: 24,
    fontColor: "#ffffff",
    opacity: 0.8,
  },
  "extract-audio": { format: "mp3", bitrate: 192 },
  gif: { startTime: 0, duration: 5, fps: 10, width: 480 },
  merge: {},
  "add-subtitles": { burnIn: false },
};

export default function Upload() {
  const navigate = useNavigate();
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedOperation, setSelectedOperation] = useState<JobOperation | null>(null);
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const updateOption = useCallback(
    (key: string, value: unknown) => {
      setOptions((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("video/")) {
        setError("Please select a video file");
        return;
      }
      setError(null);
      setIsUploading(true);
      setUploadProgress(0);
      setUploadResponse(null);

      // Simulate progress during upload (fetch doesn't support progress)
      const progressInterval = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 10, 90));
      }, 200);

      try {
        const res = await uploadFile(file);
        clearInterval(progressInterval);
        setUploadProgress(100);
        setUploadResponse(res);
        if (selectedOperation) {
          setOptions(DEFAULT_OPTIONS[selectedOperation]);
        }
      } catch (err) {
        clearInterval(progressInterval);
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [selectedOperation]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
      e.target.value = "";
    },
    [handleFileSelect]
  );

  const handleOperationSelect = useCallback((op: JobOperation) => {
    setSelectedOperation(op);
    setOptions(DEFAULT_OPTIONS[op]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!uploadResponse || !selectedOperation) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await createJobFromUpload(
        uploadResponse.filename,
        uploadResponse.originalName,
        selectedOperation,
        options
      );
      const jobId = res?.jobId ?? res?.id;
      navigate(`/jobs/${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setIsSubmitting(false);
    }
  }, [uploadResponse, selectedOperation, options, navigate]);

  const canSubmit = uploadResponse && selectedOperation && !isUploading && !isSubmitting;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-100">Upload & Process</h1>
        <p className="text-dark-400 mt-1">
          Upload a video, choose an operation, and start processing
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Upload + Options */}
        <div className="xl:col-span-2 space-y-6">
          {/* Drag & Drop Upload Zone */}
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-dark-100 mb-4 flex items-center gap-2">
              <UploadIcon className="w-5 h-5 text-blue-400" />
              Upload Video
            </h2>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer
                ${isDragging ? "border-blue-500 bg-blue-500/10" : "border-dark-600 hover:border-dark-500 hover:bg-dark-800/50"}
              `}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileInputChange}
                disabled={isUploading}
              />
              {isUploading ? (
                <div className="space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                  <p className="text-dark-300">Uploading...</p>
                  <div className="h-2 bg-dark-700 rounded-full overflow-hidden max-w-xs mx-auto">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : uploadResponse ? (
                <div className="space-y-2">
                  <Film className="w-12 h-12 mx-auto text-emerald-500" />
                  <p className="text-dark-100 font-medium">{uploadResponse.originalName}</p>
                  <p className="text-sm text-dark-400">
                    {formatBytes(uploadResponse.size)} • Ready to process
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <UploadIcon className="w-12 h-12 mx-auto text-dark-400" />
                  <p className="text-dark-200">Drop video here or click to browse</p>
                  <p className="text-sm text-dark-400">Supports MP4, WebM, MKV, and more</p>
                </div>
              )}
            </div>
          </div>

          {/* Operation Selector */}
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-dark-100 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-400" />
              Choose Operation
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {OPERATIONS.map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => handleOperationSelect(op)}
                  className={`
                    text-left p-4 rounded-xl border transition-all
                    ${selectedOperation === op
                      ? "bg-blue-600/20 border-blue-500 text-blue-400"
                      : "bg-dark-800 border-dark-700 hover:border-dark-600 text-dark-200"
                    }
                  `}
                >
                  <p className="font-medium text-sm">{OPERATION_LABELS[op]}</p>
                  <p className="text-xs text-dark-400 mt-0.5 line-clamp-2">
                    {OPERATION_DESCRIPTIONS[op]}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Options Form */}
          {selectedOperation && (
            <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-dark-100 mb-4">
                {OPERATION_LABELS[selectedOperation]} Options
              </h2>
              <div className="space-y-4">
                {selectedOperation === "compress" && (
                  <>
                    <div>
                      <label className="label">Codec</label>
                      <select
                        className="select"
                        value={(options.codec as string) ?? "h264"}
                        onChange={(e) => updateOption("codec", e.target.value)}
                      >
                        <option value="h264">H.264</option>
                        <option value="h265">H.265 (HEVC)</option>
                        <option value="vp9">VP9</option>
                        <option value="av1">AV1</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">CRF (0–51, lower = better quality)</label>
                      <input
                        type="range"
                        min={0}
                        max={51}
                        value={(options.crf as number) ?? 23}
                        onChange={(e) => updateOption("crf", Number(e.target.value))}
                        className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <p className="text-sm text-dark-400 mt-1">{(options.crf as number) ?? 23}</p>
                    </div>
                    <div>
                      <label className="label">Preset</label>
                      <select
                        className="select"
                        value={(options.preset as string) ?? "medium"}
                        onChange={(e) => updateOption("preset", e.target.value)}
                      >
                        <option value="ultrafast">Ultrafast</option>
                        <option value="superfast">Superfast</option>
                        <option value="veryfast">Veryfast</option>
                        <option value="faster">Faster</option>
                        <option value="fast">Fast</option>
                        <option value="medium">Medium</option>
                        <option value="slow">Slow</option>
                        <option value="slower">Slower</option>
                        <option value="veryslow">Veryslow</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Audio Bitrate (kbps)</label>
                      <input
                        type="number"
                        className="input"
                        value={(options.audioBitrate as number) ?? 128}
                        onChange={(e) => updateOption("audioBitrate", Number(e.target.value))}
                        min={64}
                        max={320}
                      />
                    </div>
                  </>
                )}
                {selectedOperation === "transcode" && (
                  <>
                    <div>
                      <label className="label">Format</label>
                      <select
                        className="select"
                        value={(options.format as string) ?? "mp4"}
                        onChange={(e) => updateOption("format", e.target.value)}
                      >
                        <option value="mp4">MP4</option>
                        <option value="webm">WebM</option>
                        <option value="mkv">MKV</option>
                        <option value="avi">AVI</option>
                        <option value="mov">MOV</option>
                        <option value="flv">FLV</option>
                        <option value="ogg">OGG</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="copyMode"
                        checked={(options.copyMode as boolean) ?? false}
                        onChange={(e) => updateOption("copyMode", e.target.checked)}
                        className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-blue-500 focus:ring-blue-500"
                      />
                      <label htmlFor="copyMode" className="label mb-0 cursor-pointer">
                        Copy mode (no re-encode)
                      </label>
                    </div>
                  </>
                )}
                {selectedOperation === "hls" && (
                  <div>
                    <label className="label">Segment Duration (seconds)</label>
                    <input
                      type="number"
                      className="input"
                      value={(options.segmentDuration as number) ?? 6}
                      onChange={(e) => updateOption("segmentDuration", Number(e.target.value))}
                      min={1}
                      max={30}
                    />
                  </div>
                )}
                {selectedOperation === "dash" && (
                  <div>
                    <label className="label">Segment Duration (seconds)</label>
                    <input
                      type="number"
                      className="input"
                      value={(options.segmentDuration as number) ?? 6}
                      onChange={(e) => updateOption("segmentDuration", Number(e.target.value))}
                      min={1}
                      max={30}
                    />
                  </div>
                )}
                {selectedOperation === "thumbnail" && (
                  <>
                    <div>
                      <label className="label">Mode</label>
                      <select
                        className="select"
                        value={(options.mode as string) ?? "single"}
                        onChange={(e) => updateOption("mode", e.target.value)}
                      >
                        <option value="single">Single</option>
                        <option value="grid">Grid</option>
                        <option value="interval">Interval</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Timestamp (seconds)</label>
                      <input
                        type="number"
                        className="input"
                        value={(options.timestamp as number) ?? 0}
                        onChange={(e) => updateOption("timestamp", Number(e.target.value))}
                        min={0}
                      />
                    </div>
                    <div>
                      <label className="label">Count</label>
                      <input
                        type="number"
                        className="input"
                        value={(options.count as number) ?? 1}
                        onChange={(e) => updateOption("count", Number(e.target.value))}
                        min={1}
                      />
                    </div>
                  </>
                )}
                {selectedOperation === "trim" && (
                  <>
                    <div>
                      <label className="label">Start Time (seconds)</label>
                      <input
                        type="number"
                        className="input"
                        value={(options.startTime as number) ?? 0}
                        onChange={(e) => updateOption("startTime", Number(e.target.value))}
                        min={0}
                      />
                    </div>
                    <div>
                      <label className="label">End Time (seconds)</label>
                      <input
                        type="number"
                        className="input"
                        value={(options.endTime as number) ?? 60}
                        onChange={(e) => updateOption("endTime", Number(e.target.value))}
                        min={0}
                      />
                    </div>
                  </>
                )}
                {selectedOperation === "resize" && (
                  <>
                    <div>
                      <label className="label">Width</label>
                      <input
                        type="number"
                        className="input"
                        value={(options.width as number) ?? 1920}
                        onChange={(e) => updateOption("width", Number(e.target.value))}
                        min={1}
                      />
                    </div>
                    <div>
                      <label className="label">Height</label>
                      <input
                        type="number"
                        className="input"
                        value={(options.height as number) ?? 1080}
                        onChange={(e) => updateOption("height", Number(e.target.value))}
                        min={1}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="maintainAspectRatio"
                        checked={(options.maintainAspectRatio as boolean) ?? true}
                        onChange={(e) => updateOption("maintainAspectRatio", e.target.checked)}
                        className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-blue-500 focus:ring-blue-500"
                      />
                      <label htmlFor="maintainAspectRatio" className="label mb-0 cursor-pointer">
                        Maintain aspect ratio
                      </label>
                    </div>
                  </>
                )}
                {selectedOperation === "watermark" && (
                  <>
                    <div>
                      <label className="label">Type</label>
                      <select
                        className="select"
                        value={(options.type as string) ?? "text"}
                        onChange={(e) => updateOption("type", e.target.value)}
                      >
                        <option value="image">Image</option>
                        <option value="text">Text</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Text</label>
                      <input
                        type="text"
                        className="input"
                        value={(options.text as string) ?? "Watermark"}
                        onChange={(e) => updateOption("text", e.target.value)}
                        placeholder="Watermark text"
                      />
                    </div>
                    <div>
                      <label className="label">Position</label>
                      <select
                        className="select"
                        value={(options.position as string) ?? "bottom-right"}
                        onChange={(e) => updateOption("position", e.target.value)}
                      >
                        <option value="top-left">Top Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-right">Bottom Right</option>
                        <option value="center">Center</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Font Size</label>
                      <input
                        type="number"
                        className="input"
                        value={(options.fontSize as number) ?? 24}
                        onChange={(e) => updateOption("fontSize", Number(e.target.value))}
                        min={8}
                        max={120}
                      />
                    </div>
                    <div>
                      <label className="label">Font Color</label>
                      <input
                        type="text"
                        className="input"
                        value={(options.fontColor as string) ?? "#ffffff"}
                        onChange={(e) => updateOption("fontColor", e.target.value)}
                        placeholder="#ffffff"
                      />
                    </div>
                    <div>
                      <label className="label">Opacity (0–1)</label>
                      <input
                        type="number"
                        className="input"
                        value={(options.opacity as number) ?? 0.8}
                        onChange={(e) => updateOption("opacity", Number(e.target.value))}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                    </div>
                  </>
                )}
                {selectedOperation === "extract-audio" && (
                  <>
                    <div>
                      <label className="label">Format</label>
                      <select
                        className="select"
                        value={(options.format as string) ?? "mp3"}
                        onChange={(e) => updateOption("format", e.target.value)}
                      >
                        <option value="mp3">MP3</option>
                        <option value="aac">AAC</option>
                        <option value="wav">WAV</option>
                        <option value="flac">FLAC</option>
                        <option value="ogg">OGG</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Bitrate (kbps)</label>
                      <input
                        type="number"
                        className="input"
                        value={(options.bitrate as number) ?? 192}
                        onChange={(e) => updateOption("bitrate", Number(e.target.value))}
                        min={64}
                        max={320}
                      />
                    </div>
                  </>
                )}
                {selectedOperation === "gif" && (
                  <>
                    <div>
                      <label className="label">Start Time (seconds)</label>
                      <input
                        type="number"
                        className="input"
                        value={(options.startTime as number) ?? 0}
                        onChange={(e) => updateOption("startTime", Number(e.target.value))}
                        min={0}
                      />
                    </div>
                    <div>
                      <label className="label">Duration (seconds)</label>
                      <input
                        type="number"
                        className="input"
                        value={(options.duration as number) ?? 5}
                        onChange={(e) => updateOption("duration", Number(e.target.value))}
                        min={0.1}
                      />
                    </div>
                    <div>
                      <label className="label">FPS</label>
                      <input
                        type="number"
                        className="input"
                        value={(options.fps as number) ?? 10}
                        onChange={(e) => updateOption("fps", Number(e.target.value))}
                        min={1}
                        max={30}
                      />
                    </div>
                    <div>
                      <label className="label">Width</label>
                      <input
                        type="number"
                        className="input"
                        value={(options.width as number) ?? 480}
                        onChange={(e) => updateOption("width", Number(e.target.value))}
                        min={1}
                      />
                    </div>
                  </>
                )}
                {selectedOperation === "merge" && (
                  <p className="text-dark-400 text-sm py-2">
                    Upload multiple files to merge them. Add more files in a future step.
                  </p>
                )}
                {selectedOperation === "add-subtitles" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="burnIn"
                      checked={(options.burnIn as boolean) ?? false}
                      onChange={(e) => updateOption("burnIn", e.target.checked)}
                      className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-blue-500 focus:ring-blue-500"
                    />
                    <label htmlFor="burnIn" className="label mb-0 cursor-pointer">
                      Burn subtitles into video
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Video Preview */}
        <div className="space-y-6">
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-dark-100 mb-4 flex items-center gap-2">
              <Play className="w-5 h-5 text-blue-400" />
              Preview
            </h2>
            {uploadResponse ? (
              <div className="aspect-video bg-dark-950 rounded-lg overflow-hidden">
                <video
                  src={getUploadStreamUrl(uploadResponse.filename)}
                  controls
                  className="w-full h-full object-contain"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            ) : (
              <div className="aspect-video bg-dark-950 rounded-lg flex items-center justify-center border border-dashed border-dark-700">
                <div className="text-center text-dark-500">
                  <Film className="w-16 h-16 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Upload a video to preview</p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="btn-primary w-full mt-6"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating job...
                </>
              ) : (
                <>
                  <UploadIcon className="w-4 h-4" />
                  Process Video
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
