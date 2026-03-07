const API_BASE = "/api/v1";

async function request<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || `Request failed with status ${res.status}`);
  }

  return json;
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

export async function uploadFile(file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await request("/jobs/upload", { method: "POST", body: formData });
  return res.data;
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
  const res = await request("/jobs", { method: "POST", body: formData });
  return res.data;
}

export async function createJobFromUpload(
  filename: string,
  originalFilename: string,
  operation: string,
  options: Record<string, unknown>
): Promise<any> {
  const res = await request("/jobs/from-upload", {
    method: "POST",
    body: JSON.stringify({ filename, originalFilename, operation, options }),
  });
  return res.data;
}

export async function getJobs(params?: {
  page?: number;
  limit?: number;
  status?: string;
  operation?: string;
}): Promise<{ jobs: any[]; total: number; page: number; limit: number; totalPages: number }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.status) searchParams.set("status", params.status);
  if (params?.operation) searchParams.set("operation", params.operation);

  const qs = searchParams.toString();
  const res = await request(`/jobs${qs ? `?${qs}` : ""}`);
  return {
    jobs: res.data || [],
    total: res.pagination?.total || 0,
    page: res.pagination?.page || 1,
    limit: res.pagination?.limit || 20,
    totalPages: res.pagination?.totalPages || 1,
  };
}

export async function getJob(id: string): Promise<any> {
  const res = await request(`/jobs/${id}`);
  return res.data;
}

export async function probeJob(id: string): Promise<any> {
  const res = await request(`/jobs/${id}/probe`);
  return res.data;
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

export async function getJobFiles(jobId: string): Promise<any[]> {
  const res = await request(`/files/${jobId}`);
  return res.data || [];
}

export function getFileDownloadUrl(jobId: string, filename: string): string {
  return `${API_BASE}/files/${jobId}/${encodeURIComponent(filename)}`;
}

export function getUploadStreamUrl(filename: string): string {
  return `${API_BASE}/files/uploads/${encodeURIComponent(filename)}`;
}

// ─── Health & Stats ──────────────────────────────────────────────────────────

export async function getHealth(): Promise<any> {
  const res = await request("/health");
  return res.data;
}

export async function getStats(): Promise<{ queue: any; system: any }> {
  const res = await request("/health/stats");
  return res.data;
}
