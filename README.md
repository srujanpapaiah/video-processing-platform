# 🎬 Video Processing Platform

A production-grade video processing platform powered by **FFmpeg**, with a **BullMQ** job queue, **real-time Socket.IO** progress tracking, and a modern **React dashboard**.

## Features

### 🔧 12 FFmpeg Operations

| Operation | Description |
|-----------|-------------|
| **Compress** | Reduce file size — CRF quality control, H.264/H.265/VP9/AV1 codecs, configurable presets |
| **Transcode** | Format conversion — MP4, WebM, MKV, AVI, MOV, FLV, OGG with optional stream copy |
| **HLS Streaming** | Adaptive bitrate HLS — multi-resolution ladder, configurable segment duration |
| **DASH Streaming** | MPEG-DASH packaging — MPD manifest, multiple quality levels |
| **Thumbnails** | Extract frames — single timestamp, interval-based, or sprite grid |
| **Trim / Cut** | Segment extraction — start/end time, stream copy or precise re-encode |
| **Resize** | Resolution change — custom width/height, aspect ratio preservation |
| **Watermark** | Overlay — image or text watermark with position & opacity control |
| **Extract Audio** | Audio extraction — MP3, AAC, WAV, FLAC, OGG output |
| **Create GIF** | Video to GIF — palette-optimized, configurable FPS & resolution |
| **Merge** | Concatenation — join multiple videos with re-encoding |
| **Add Subtitles** | Subtitle embedding — burn-in (hardcode) or soft subtitle streams |

### 📊 Real-time Dashboard

- **Live progress tracking** — Socket.IO pushes FFmpeg progress in real-time
- **Queue monitoring** — waiting, active, completed, failed job counts
- **System stats** — CPU, memory, disk usage monitoring
- **Drag & drop upload** — up to 2GB video files
- **Dynamic operation forms** — per-operation configuration UI
- **Job management** — retry, cancel, delete with one click

### 🏗️ Architecture

- **Server**: Express.js + TypeScript + Node.js 22
- **Queue**: BullMQ with Redis for reliable job processing
- **FFmpeg**: System FFmpeg 6.x with full codec support
- **Real-time**: Socket.IO for bidirectional WebSocket communication
- **Client**: React 19 + Vite + TailwindCSS + React Router + TanStack Query
- **Monitoring**: Bull Board admin dashboard at `/admin/queues`

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 20
- **Redis** server running
- **FFmpeg** and **FFprobe** installed on system PATH

### 1. Clone & Install

```bash
git clone <repo-url>
cd video-processing
npm install
```

### 2. Configure Environment

```bash
cp .env.example server/.env
```

Edit `server/.env`:
```env
NODE_ENV=development
PORT=4000
REDIS_URL=redis://localhost:6379
UPLOAD_DIR=./uploads
OUTPUT_DIR=./output
MAX_FILE_SIZE_MB=2048
MAX_CONCURRENT_JOBS=2
CORS_ORIGINS=http://localhost:5173
```

### 3. Start Development

```bash
# Start both server and client
npm run dev

# Or start separately
npm run dev:server   # → http://localhost:4000
npm run dev:client   # → http://localhost:5173
```

### 4. Open Dashboard

Navigate to **http://localhost:5173**

---

## Production Deployment

```bash
# Build everything
npm run build

# Start server (serves client build too)
NODE_ENV=production npm start
```

The server will serve the React client from `client/dist/` in production mode.

---

## API Reference

### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/jobs/upload` | Upload a video file |
| `POST` | `/api/v1/jobs` | Upload + create job in one step |
| `POST` | `/api/v1/jobs/from-upload` | Create job from previously uploaded file |
| `GET` | `/api/v1/jobs` | List all jobs (paginated, filterable) |
| `GET` | `/api/v1/jobs/:id` | Get job details |
| `GET` | `/api/v1/jobs/:id/probe` | Get input video metadata via FFprobe |
| `POST` | `/api/v1/jobs/:id/retry` | Retry a failed job |
| `POST` | `/api/v1/jobs/:id/cancel` | Cancel a running/waiting job |
| `DELETE` | `/api/v1/jobs/:id` | Delete a job and its files |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/files/:jobId` | List output files for a job |
| `GET` | `/api/v1/files/:jobId/:filename` | Download/stream output file |
| `GET` | `/api/v1/files/uploads/:filename` | Stream uploaded file |

### Health & Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/health` | Server health check |
| `GET` | `/api/v1/health/stats` | Queue + system statistics |

### WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `job:progress` | Server → Client | `{ jobId, progress, currentFps, speed, timemark }` |
| `job:active` | Server → Client | `{ jobId }` |
| `job:completed` | Server → Client | `{ jobId, result }` |
| `job:failed` | Server → Client | `{ jobId, error }` |
| `queue:stats` | Server → Client | `{ waiting, active, completed, failed, delayed }` |

---

## Example API Usage

### Upload & Compress

```bash
# Upload a video
curl -X POST http://localhost:4000/api/v1/jobs/upload \
  -F "file=@video.mp4"

# Response: { "data": { "filename": "abc123.mp4", ... } }

# Create compression job
curl -X POST http://localhost:4000/api/v1/jobs/from-upload \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "abc123.mp4",
    "originalFilename": "video.mp4",
    "operation": "compress",
    "options": {
      "codec": "h264",
      "crf": 28,
      "preset": "fast"
    }
  }'
```

### Create HLS Stream

```bash
curl -X POST http://localhost:4000/api/v1/jobs/from-upload \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "abc123.mp4",
    "originalFilename": "video.mp4",
    "operation": "hls",
    "options": {
      "segmentDuration": 6,
      "resolutions": [
        { "name": "1080p", "width": 1920, "height": 1080, "bitrate": "5000k" },
        { "name": "720p", "width": 1280, "height": 720, "bitrate": "2800k" },
        { "name": "360p", "width": 640, "height": 360, "bitrate": "800k" }
      ]
    }
  }'
```

---

## Project Structure

```
video-processing/
├── server/                     # Express API + BullMQ workers
│   ├── src/
│   │   ├── index.ts            # Entry point, graceful shutdown
│   │   ├── app.ts              # Express + Socket.IO + Bull Board
│   │   ├── config/             # Zod-validated environment config
│   │   ├── routes/             # API route definitions
│   │   ├── controllers/        # Request handlers
│   │   ├── services/
│   │   │   ├── ffmpeg.service.ts    # 12 FFmpeg operations
│   │   │   ├── ffprobe.service.ts   # Video metadata extraction
│   │   │   ├── storage.service.ts   # File system management
│   │   │   └── queue.service.ts     # BullMQ queue management
│   │   ├── workers/
│   │   │   └── video.worker.ts      # Job processor
│   │   ├── socket/             # Socket.IO event handlers
│   │   ├── middlewares/        # Error handling, upload, validation
│   │   ├── schemas/            # Zod validation schemas
│   │   ├── types/              # TypeScript type definitions
│   │   ├── errors/             # Custom error classes
│   │   └── utils/              # Logger, system utilities
│   ├── package.json
│   └── tsconfig.json
├── client/                     # React dashboard
│   ├── src/
│   │   ├── pages/              # Dashboard, Upload, Jobs, JobDetail, System
│   │   ├── components/         # Layout, Sidebar, StatusBadge, ProgressBar
│   │   ├── hooks/              # Socket.IO hooks
│   │   ├── lib/                # API client, socket client, utilities
│   │   └── types/              # Shared type definitions
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── package.json                # Workspace root
├── .env.example
└── README.md
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Node.js 22 | Server runtime |
| Framework | Express.js 4 | HTTP API |
| Language | TypeScript 5.7 | Type safety |
| Video | FFmpeg 6.x | Video processing engine |
| Queue | BullMQ 5 | Job queue with Redis |
| Real-time | Socket.IO 4 | WebSocket communication |
| Validation | Zod 3 | Schema validation |
| Upload | Multer | File upload (disk storage) |
| Logging | Winston 3 | Structured logging |
| Frontend | React 19 | UI framework |
| Build | Vite 6 | Frontend build tool |
| Styling | TailwindCSS 3 | Utility-first CSS |
| Routing | React Router 7 | Client-side routing |
| Data | TanStack Query 5 | Server state management |
| Icons | Lucide React | SVG icon library |

---

## License

MIT
