import ffmpeg, { FfmpegCommand } from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import { FFmpegProgress } from "../types";
import config from "../config";
import logger from "../utils/logger";

// Use system ffmpeg
if (config.FFMPEG_PATH) ffmpeg.setFfmpegPath(config.FFMPEG_PATH);
if (config.FFPROBE_PATH) ffmpeg.setFfprobePath(config.FFPROBE_PATH);

const DEFAULT_TIMEOUT = 60 * 60 * 1000; // 1 hour

type ProgressCallback = (progress: FFmpegProgress) => void;

// Track active commands for cancellation
const activeCommands = new Map<string, FfmpegCommand>();

function runCommand(
  command: FfmpegCommand,
  jobId: string,
  onProgress?: ProgressCallback
): Promise<void> {
  return new Promise((resolve, reject) => {
    activeCommands.set(jobId, command);

    command
      .on("start", (cmd) => {
        logger.info(`[${jobId}] FFmpeg started: ${cmd}`);
      })
      .on("progress", (progress) => {
        if (onProgress) {
          onProgress({
            percent: progress.percent || 0,
            frames: progress.frames,
            currentFps: progress.currentFps,
            currentKbps: progress.currentKbps,
            targetSize: progress.targetSize,
            timemark: progress.timemark,
          });
        }
      })
      .on("end", () => {
        activeCommands.delete(jobId);
        logger.info(`[${jobId}] FFmpeg completed`);
        resolve();
      })
      .on("error", (err, _stdout, stderr) => {
        activeCommands.delete(jobId);
        logger.error(`[${jobId}] FFmpeg error: ${err.message}`);
        if (stderr) logger.error(`[${jobId}] FFmpeg stderr: ${stderr}`);
        reject(new Error(`FFmpeg error: ${err.message}`));
      });

    command.run();
  });
}

export function cancelJob(jobId: string): boolean {
  const command = activeCommands.get(jobId);
  if (command) {
    command.kill("SIGKILL");
    activeCommands.delete(jobId);
    logger.info(`[${jobId}] FFmpeg process killed`);
    return true;
  }
  return false;
}

// ─── 1. Compress ─────────────────────────────────────────────────────────────

export async function compress(
  input: string,
  output: string,
  options: {
    codec?: string;
    crf?: number;
    preset?: string;
    audioBitrate?: string;
  },
  jobId: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const {
    codec = "h264",
    crf = 23,
    preset = "medium",
    audioBitrate = "128k",
  } = options;

  const codecMap: Record<string, string> = {
    h264: "libx264",
    h265: "libx265",
    vp9: "libvpx-vp9",
    av1: "libsvtav1",
  };

  const videoCodec = codecMap[codec] || "libx264";
  const outputFile = output.endsWith(".mp4") ? output : `${output}.mp4`;

  const command = ffmpeg(input)
    .videoCodec(videoCodec)
    .audioCodec("aac")
    .audioBitrate(audioBitrate)
    .outputOptions(["-crf", String(crf), "-preset", preset])
    .output(outputFile);

  await runCommand(command, jobId, onProgress);
  return outputFile;
}

// ─── 2. Transcode ────────────────────────────────────────────────────────────

export async function transcode(
  input: string,
  output: string,
  options: {
    format?: string;
    videoCodec?: string;
    audioCodec?: string;
    copyMode?: boolean;
  },
  jobId: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const { format = "mp4", videoCodec, audioCodec, copyMode = false } = options;

  const ext = `.${format}`;
  const outputFile = output.endsWith(ext) ? output : `${output}${ext}`;

  const command = ffmpeg(input).output(outputFile);

  if (copyMode) {
    command.videoCodec("copy").audioCodec("copy");
  } else {
    if (videoCodec) command.videoCodec(videoCodec);
    if (audioCodec) command.audioCodec(audioCodec);
  }

  command.format(format === "mkv" ? "matroska" : format);

  await runCommand(command, jobId, onProgress);
  return outputFile;
}

// ─── 3. HLS ──────────────────────────────────────────────────────────────────

export async function generateHLS(
  input: string,
  outputDir: string,
  options: {
    resolutions?: { name: string; width: number; height: number; bitrate: string }[];
    segmentDuration?: number;
  },
  jobId: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const {
    resolutions = [
      { name: "1080p", width: 1920, height: 1080, bitrate: "5000k" },
      { name: "720p", width: 1280, height: 720, bitrate: "2800k" },
      { name: "480p", width: 854, height: 480, bitrate: "1400k" },
      { name: "360p", width: 640, height: 360, bitrate: "800k" },
    ],
    segmentDuration = 6,
  } = options;

  fs.mkdirSync(outputDir, { recursive: true });

  // Process each resolution sequentially for progress tracking
  const totalResolutions = resolutions.length;
  let completedResolutions = 0;

  for (const res of resolutions) {
    const playlistPath = path.join(outputDir, `${res.name}.m3u8`);
    const segmentPattern = path.join(outputDir, `${res.name}_%03d.ts`);

    const command = ffmpeg(input)
      .videoCodec("libx264")
      .audioCodec("aac")
      .size(`${res.width}x${res.height}`)
      .videoBitrate(res.bitrate)
      .outputOptions([
        "-preset", "fast",
        "-hls_time", String(segmentDuration),
        "-hls_playlist_type", "vod",
        "-hls_flags", "independent_segments",
        "-hls_segment_type", "mpegts",
        "-hls_segment_filename", segmentPattern,
        "-f", "hls",
      ])
      .output(playlistPath);

    await runCommand(command, `${jobId}-${res.name}`, (p) => {
      if (onProgress) {
        const overallPercent = ((completedResolutions + (p.percent || 0) / 100) / totalResolutions) * 100;
        onProgress({ ...p, percent: Math.min(overallPercent, 99) });
      }
    });

    completedResolutions++;
  }

  // Create master playlist
  let masterPlaylist = "#EXTM3U\n#EXT-X-VERSION:3\n";
  for (const res of resolutions) {
    const bandwidth = parseInt(res.bitrate) * 1000;
    masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${res.width}x${res.height}\n`;
    masterPlaylist += `${res.name}.m3u8\n`;
  }
  fs.writeFileSync(path.join(outputDir, "master.m3u8"), masterPlaylist);

  if (onProgress) onProgress({ percent: 100 });
  return outputDir;
}

// ─── 4. DASH ─────────────────────────────────────────────────────────────────

export async function generateDASH(
  input: string,
  outputDir: string,
  options: {
    resolutions?: { name: string; width: number; height: number; bitrate: string }[];
    segmentDuration?: number;
  },
  jobId: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const {
    resolutions = [
      { name: "1080p", width: 1920, height: 1080, bitrate: "5000k" },
      { name: "720p", width: 1280, height: 720, bitrate: "2800k" },
      { name: "480p", width: 854, height: 480, bitrate: "1400k" },
    ],
    segmentDuration = 4,
  } = options;

  fs.mkdirSync(outputDir, { recursive: true });

  // Create intermediate files for each resolution then combine
  const intermediateFiles: string[] = [];
  const totalResolutions = resolutions.length;
  let completedResolutions = 0;

  for (const res of resolutions) {
    const intermediateFile = path.join(outputDir, `${res.name}_intermediate.mp4`);
    intermediateFiles.push(intermediateFile);

    const command = ffmpeg(input)
      .videoCodec("libx264")
      .audioCodec("aac")
      .size(`${res.width}x${res.height}`)
      .videoBitrate(res.bitrate)
      .outputOptions(["-preset", "fast"])
      .output(intermediateFile);

    await runCommand(command, `${jobId}-${res.name}`, (p) => {
      if (onProgress) {
        const overallPercent = ((completedResolutions + (p.percent || 0) / 100) / (totalResolutions + 1)) * 100;
        onProgress({ ...p, percent: Math.min(overallPercent, 99) });
      }
    });

    completedResolutions++;
  }

  // Generate DASH manifest from intermediate files
  const manifestPath = path.join(outputDir, "manifest.mpd");
  // Use ffmpeg to create DASH from the first resolution (simplified)
  // In production, you'd use MP4Box or shaka-packager for proper DASH
  const command = ffmpeg(intermediateFiles[0])
    .outputOptions([
      "-f", "dash",
      "-seg_duration", String(segmentDuration),
      "-use_template", "1",
      "-use_timeline", "1",
      "-init_seg_name", "init-$RepresentationID$.m4s",
      "-media_seg_name", "chunk-$RepresentationID$-$Number%05d$.m4s",
    ])
    .output(manifestPath);

  await runCommand(command, `${jobId}-dash`, (p) => {
    if (onProgress) {
      const overallPercent = ((completedResolutions + (p.percent || 0) / 100) / (totalResolutions + 1)) * 100;
      onProgress({ ...p, percent: Math.min(overallPercent, 99) });
    }
  });

  // Clean up intermediate files
  for (const file of intermediateFiles) {
    try { fs.unlinkSync(file); } catch { /* ignore */ }
  }

  if (onProgress) onProgress({ percent: 100 });
  return outputDir;
}

// ─── 5. Thumbnails ───────────────────────────────────────────────────────────

export async function generateThumbnails(
  input: string,
  outputDir: string,
  options: {
    mode?: string;
    timestamp?: string;
    interval?: number;
    count?: number;
    width?: number;
    height?: number;
    columns?: number;
  },
  jobId: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const {
    mode = "single",
    timestamp = "00:00:01",
    interval,
    count = 1,
    width,
    height,
    columns = 4,
  } = options;

  fs.mkdirSync(outputDir, { recursive: true });

  const sizeOption = width && height ? `${width}x${height}` : width ? `${width}x?` : "320x?";

  if (mode === "single") {
    const outputFile = path.join(outputDir, "thumbnail.jpg");
    const command = ffmpeg(input)
      .seekInput(timestamp)
      .frames(1)
      .size(sizeOption)
      .output(outputFile);

    await runCommand(command, jobId, onProgress);
    if (onProgress) onProgress({ percent: 100 });
    return outputDir;
  }

  if (mode === "interval" && interval) {
    const outputPattern = path.join(outputDir, "thumb_%04d.jpg");
    const command = ffmpeg(input)
      .outputOptions([
        "-vf", `fps=1/${interval},scale=${sizeOption.replace("x", ":")}`,
      ])
      .output(outputPattern);

    await runCommand(command, jobId, onProgress);
    if (onProgress) onProgress({ percent: 100 });
    return outputDir;
  }

  if (mode === "grid") {
    // Generate individual thumbnails first, then tile them
    const rows = Math.ceil(count / columns);
    const tileSize = sizeOption.replace("x", ":");

    const outputFile = path.join(outputDir, "grid.jpg");
    const command = ffmpeg(input)
      .outputOptions([
        "-vf", `select='not(mod(n\\,${Math.max(1, Math.floor(100 / count))}))',scale=${tileSize},tile=${columns}x${rows}`,
        "-frames:v", "1",
        "-vsync", "vfr",
      ])
      .output(outputFile);

    await runCommand(command, jobId, onProgress);
    if (onProgress) onProgress({ percent: 100 });
    return outputDir;
  }

  if (onProgress) onProgress({ percent: 100 });
  return outputDir;
}

// ─── 6. Trim ─────────────────────────────────────────────────────────────────

export async function trim(
  input: string,
  output: string,
  options: {
    startTime?: string;
    endTime?: string;
    duration?: string;
    copyMode?: boolean;
  },
  jobId: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const { startTime = "0", endTime, duration, copyMode = true } = options;

  const outputFile = output.endsWith(".mp4") ? output : `${output}.mp4`;

  const command = ffmpeg(input)
    .seekInput(startTime)
    .output(outputFile);

  if (endTime) {
    command.inputOptions(["-to", endTime]);
  } else if (duration) {
    command.duration(duration);
  }

  if (copyMode) {
    command.videoCodec("copy").audioCodec("copy");
  }

  await runCommand(command, jobId, onProgress);
  return outputFile;
}

// ─── 7. Resize ───────────────────────────────────────────────────────────────

export async function resize(
  input: string,
  output: string,
  options: {
    width?: number;
    height?: number;
    maintainAspectRatio?: boolean;
  },
  jobId: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const { width, height, maintainAspectRatio = true } = options;
  const outputFile = output.endsWith(".mp4") ? output : `${output}.mp4`;

  let scaleFilter: string;
  if (width && height && !maintainAspectRatio) {
    scaleFilter = `scale=${width}:${height}`;
  } else if (width && height) {
    scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;
  } else if (width) {
    scaleFilter = `scale=${width}:-2`;
  } else if (height) {
    scaleFilter = `scale=-2:${height}`;
  } else {
    scaleFilter = "scale=1280:-2";
  }

  const command = ffmpeg(input)
    .videoCodec("libx264")
    .audioCodec("aac")
    .outputOptions(["-vf", scaleFilter, "-preset", "fast"])
    .output(outputFile);

  await runCommand(command, jobId, onProgress);
  return outputFile;
}

// ─── 8. Watermark ────────────────────────────────────────────────────────────

export async function watermark(
  input: string,
  output: string,
  options: {
    type?: string;
    imagePath?: string;
    text?: string;
    fontSize?: number;
    fontColor?: string;
    position?: string;
    opacity?: number;
  },
  jobId: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const {
    type = "text",
    imagePath,
    text = "Watermark",
    fontSize = 24,
    fontColor = "white",
    position = "bottom-right",
    opacity = 0.8,
  } = options;

  const outputFile = output.endsWith(".mp4") ? output : `${output}.mp4`;

  const positionMap: Record<string, string> = {
    "top-left": "x=10:y=10",
    "top-right": "x=W-w-10:y=10",
    "bottom-left": "x=10:y=H-h-10",
    "bottom-right": "x=W-w-10:y=H-h-10",
    "center": "x=(W-w)/2:y=(H-h)/2",
  };

  const pos = positionMap[position] || positionMap["bottom-right"];

  if (type === "image" && imagePath && fs.existsSync(imagePath)) {
    const command = ffmpeg(input)
      .input(imagePath)
      .complexFilter([
        `[1:v]format=rgba,colorchannelmixer=aa=${opacity}[watermark]`,
        `[0:v][watermark]overlay=${pos.replace("x=", "").replace(":y=", ":")}[out]`,
      ])
      .outputOptions(["-map", "[out]", "-map", "0:a?"])
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions(["-preset", "fast"])
      .output(outputFile);

    await runCommand(command, jobId, onProgress);
  } else {
    // Text watermark
    const escapedText = text.replace(/'/g, "\\'").replace(/:/g, "\\:");
    const drawtext = `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${fontColor}@${opacity}:${pos.replace("x=", "x=").replace("y=", ":y=")}`;

    const command = ffmpeg(input)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions(["-vf", drawtext, "-preset", "fast"])
      .output(outputFile);

    await runCommand(command, jobId, onProgress);
  }

  return outputFile;
}

// ─── 9. Extract Audio ────────────────────────────────────────────────────────

export async function extractAudio(
  input: string,
  output: string,
  options: {
    format?: string;
    bitrate?: string;
    sampleRate?: number;
  },
  jobId: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const { format = "mp3", bitrate = "192k", sampleRate } = options;

  const codecMap: Record<string, string> = {
    mp3: "libmp3lame",
    aac: "aac",
    wav: "pcm_s16le",
    flac: "flac",
    ogg: "libvorbis",
  };

  const ext = `.${format}`;
  const outputFile = output.endsWith(ext) ? output : `${output}${ext}`;

  const command = ffmpeg(input)
    .noVideo()
    .audioCodec(codecMap[format] || "libmp3lame")
    .audioBitrate(bitrate)
    .output(outputFile);

  if (sampleRate) {
    command.audioFrequency(sampleRate);
  }

  await runCommand(command, jobId, onProgress);
  return outputFile;
}

// ─── 10. Create GIF ──────────────────────────────────────────────────────────

export async function createGif(
  input: string,
  output: string,
  options: {
    startTime?: string;
    duration?: string;
    fps?: number;
    width?: number;
    height?: number;
  },
  jobId: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const {
    startTime = "0",
    duration = "5",
    fps = 10,
    width = 480,
    height,
  } = options;

  const outputFile = output.endsWith(".gif") ? output : `${output}.gif`;
  const paletteFile = `${output}_palette.png`;

  const scaleFilter = height ? `scale=${width}:${height}` : `scale=${width}:-1`;

  // Step 1: Generate palette
  const paletteCommand = ffmpeg(input)
    .seekInput(startTime)
    .duration(duration)
    .outputOptions([
      "-vf", `fps=${fps},${scaleFilter}:flags=lanczos,palettegen`,
    ])
    .output(paletteFile);

  await runCommand(paletteCommand, `${jobId}-palette`, (p) => {
    if (onProgress) onProgress({ ...p, percent: (p.percent || 0) * 0.3 });
  });

  // Step 2: Create GIF using palette
  const gifCommand = ffmpeg(input)
    .input(paletteFile)
    .seekInput(startTime)
    .duration(duration)
    .complexFilter([
      `fps=${fps},${scaleFilter}:flags=lanczos[x]`,
      `[x][1:v]paletteuse[out]`,
    ])
    .outputOptions(["-map", "[out]"])
    .output(outputFile);

  await runCommand(gifCommand, `${jobId}-gif`, (p) => {
    if (onProgress) onProgress({ ...p, percent: 30 + (p.percent || 0) * 0.7 });
  });

  // Clean up palette
  try { fs.unlinkSync(paletteFile); } catch { /* ignore */ }

  if (onProgress) onProgress({ percent: 100 });
  return outputFile;
}

// ─── 11. Merge ───────────────────────────────────────────────────────────────

export async function merge(
  inputs: string[],
  output: string,
  options: {
    transition?: boolean;
  },
  jobId: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const outputFile = output.endsWith(".mp4") ? output : `${output}.mp4`;

  // Create concat file list
  const concatFilePath = `${output}_concat.txt`;
  const concatContent = inputs.map((f) => `file '${f}'`).join("\n");
  fs.writeFileSync(concatFilePath, concatContent);

  const command = ffmpeg()
    .input(concatFilePath)
    .inputOptions(["-f", "concat", "-safe", "0"])
    .videoCodec("libx264")
    .audioCodec("aac")
    .outputOptions(["-preset", "fast"])
    .output(outputFile);

  await runCommand(command, jobId, onProgress);

  // Clean up concat file
  try { fs.unlinkSync(concatFilePath); } catch { /* ignore */ }

  return outputFile;
}

// ─── 12. Add Subtitles ──────────────────────────────────────────────────────

export async function addSubtitles(
  input: string,
  output: string,
  options: {
    subtitleFile?: string;
    burnIn?: boolean;
  },
  jobId: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const { subtitleFile, burnIn = true } = options;

  if (!subtitleFile || !fs.existsSync(subtitleFile)) {
    throw new Error("Subtitle file not found");
  }

  const outputFile = output.endsWith(".mp4") ? output : `${output}.mp4`;

  if (burnIn) {
    // Hardcode subtitles into video
    const escapedPath = subtitleFile.replace(/\\/g, "/").replace(/:/g, "\\:");
    const command = ffmpeg(input)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-vf", `subtitles='${escapedPath}'`,
        "-preset", "fast",
      ])
      .output(outputFile);

    await runCommand(command, jobId, onProgress);
  } else {
    // Soft subtitles (as separate stream)
    const command = ffmpeg(input)
      .input(subtitleFile)
      .videoCodec("copy")
      .audioCodec("copy")
      .outputOptions([
        "-c:s", "mov_text",
        "-map", "0:v",
        "-map", "0:a?",
        "-map", "1:0",
      ])
      .output(outputFile);

    await runCommand(command, jobId, onProgress);
  }

  return outputFile;
}
