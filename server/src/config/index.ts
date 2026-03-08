import dotenv from "dotenv";
import { z } from "zod";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
// Also try root-level .env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),

  REDIS_URL: z.string().default("redis://localhost:6379"),

  UPLOAD_DIR: z.string().default("./uploads"),
  OUTPUT_DIR: z.string().default("./output"),

  MAX_FILE_SIZE_MB: z.coerce.number().default(2048),
  MAX_CONCURRENT_JOBS: z.coerce.number().default(2),

  CORS_ORIGINS: z.string().default("http://localhost:5173"),

  FFMPEG_PATH: z.string().optional(),
  FFPROBE_PATH: z.string().optional(),
});

function resolveDir(dir: string): string {
  if (path.isAbsolute(dir)) return dir;
  return path.resolve(process.cwd(), dir);
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.format());
  process.exit(1);
}

const env = parsed.data;

const config = {
  NODE_ENV: env.NODE_ENV,
  PORT: env.PORT,
  REDIS_URL: env.REDIS_URL,
  UPLOAD_DIR: resolveDir(env.UPLOAD_DIR),
  OUTPUT_DIR: resolveDir(env.OUTPUT_DIR),
  MAX_FILE_SIZE_MB: env.MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_BYTES: env.MAX_FILE_SIZE_MB * 1024 * 1024,
  MAX_CONCURRENT_JOBS: env.MAX_CONCURRENT_JOBS,
  CORS_ORIGINS: env.CORS_ORIGINS.split(",").map((s) => s.trim()),
  FFMPEG_PATH: env.FFMPEG_PATH,
  FFPROBE_PATH: env.FFPROBE_PATH,
  isDev: env.NODE_ENV === "development",
  isProd: env.NODE_ENV === "production",
} as const;

export default config;
