const API_BASE = "/api/v1";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data;
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

export async function uploadFile(file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  return request("/jobs/upload", { method: "POST", body: formData });
}

export async function createJob(
  file: File,
  operation: string,
  options: Record<string, unknown>
): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("operation", operation);
  formData.append("options", JSON.stringify(options));
  return request("/jobs", { method: "POST", body: formData });
}

export async function createJobFromUpload(
  filename: string,
  originalFilename: string,
  operation: string,
  options: Record<string, unknown>
): Promise<any> {
  return request("/jobs/from-upload", {
    method: "POST",
    body: JSON.stringify({ filename, originalFilename, operation, options }),
  });
}

export async function getJobs(params?: {
  page?: number;
  limit?: number;
  status?: string;
  operation?: string;
}): Promise<any> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.status) searchParams.set("status", params.status);
  if (params?.operation) searchParams.set("operation", params.operation);

  const qs = searchParams.toString();
  return request(`/jobs${qs ? `?${qs}` : ""}`);
}

export async function getJob(id: string): Promise<any> {
  return request(`/jobs/${id}`);
}

export async function probeJob(id: string): Promise<any> {
  return request(`/jobs/${id}/probe`);
}

export async function retryJob(id: string): Promise<any> {
  return request(`/jobs/${id}/retry`, { method: "POST" });
}

export async function cancelJob(id: string): Promise<any> {
  return request(`/jobs/${id}/cancel`, { method: "POST" });
}

export async function deleteJob(id: string): Promise<any> {
  return request(`/jobs/${id}`, { method: "DELETE" });
}

// ─── Files ───────────────────────────────────────────────────────────────────

export async function getJobFiles(jobId: string): Promise<any> {
  return request(`/files/${jobId}`);
}

export function getFileDownloadUrl(jobId: string, filename: string): string {
  return `${API_BASE}/files/${jobId}/${encodeURIComponent(filename)}`;
}

export function getUploadStreamUrl(filename: string): string {
  return `${API_BASE}/files/uploads/${encodeURIComponent(filename)}`;
}

// ─── Health & Stats ──────────────────────────────────────────────────────────

export async function getHealth(): Promise<any> {
  return request("/health");
}

export async function getStats(): Promise<any> {
  return request("/health/stats");
}
