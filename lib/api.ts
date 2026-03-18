// API 请求工具函数

const API_BASE = "/api";

/**
 * API 错误类
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * 处理 API 响应
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new ApiError(errorData.error || `HTTP ${response.status}`, response.status);
  }
  return response.json() as Promise<T>;
}

/**
 * GET 请求
 */
export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  return handleResponse<T>(response);
}

/**
 * POST 请求
 */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

/**
 * PUT 请求
 */
export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

/**
 * PATCH 请求
 */
export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

/**
 * DELETE 请求
 */
export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });
  return handleResponse<T>(response);
}

/**
 * 流式请求 (SSE)
 */
export async function apiStream(
  url: string,
  body: unknown
): Promise<{ stream: ReadableStream<string>; abort: () => void }> {
  const controller = new AbortController();

  const response = await fetch(`${API_BASE}${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new ApiError(errorData.error || `HTTP ${response.status}`, response.status);
  }

  if (!response.body) {
    throw new ApiError("Response body is null", 500);
  }

  // 将原始字节流转换为 SSE 文本流
  const textDecoder = new TextDecoder();
  const transformStream = new TransformStream<Uint8Array, string>({
    transform(chunk, controller) {
      const text = textDecoder.decode(chunk, { stream: true });
      controller.enqueue(text);
    },
  });

  const stream = response.body.pipeThrough(transformStream);

  return {
    stream,
    abort: () => controller.abort(),
  };
}
