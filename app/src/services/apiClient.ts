export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  `${window.location.protocol}//${window.location.hostname}:8787`;

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly kind: "http" | "network",
    public readonly status?: number
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export const isNetworkError = (error: unknown): error is ApiClientError =>
  error instanceof ApiClientError && error.kind === "network";

const readPayload = async <T,>(response: Response): Promise<T | { message?: string }> => {
  try {
    return (await response.json()) as T | { message?: string };
  } catch {
    return {} as { message?: string };
  }
};

export const readJson = async <T,>(response: Response, fallbackMessage = "Request failed."): Promise<T> => {
  const payload = await readPayload<T>(response);
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : fallbackMessage;
    throw new ApiClientError(message, "http", response.status);
  }
  return payload as T;
};

export const getJson = async <T,>(path: string, fallbackMessage?: string) => {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`);
    return readJson<T>(response, fallbackMessage);
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    throw new ApiClientError(fallbackMessage ?? "Request failed.", "network");
  }
};

export const postJson = async <T,>(path: string, body?: unknown, fallbackMessage?: string) => {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return readJson<T>(response, fallbackMessage);
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    throw new ApiClientError(fallbackMessage ?? "Request failed.", "network");
  }
};

export const patchJson = async <T,>(path: string, body: unknown, fallbackMessage?: string) => {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    return readJson<T>(response, fallbackMessage);
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    throw new ApiClientError(fallbackMessage ?? "Request failed.", "network");
  }
};

export const deleteJson = async <T,>(path: string, fallbackMessage?: string) => {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "DELETE"
    });
    return readJson<T>(response, fallbackMessage);
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    throw new ApiClientError(fallbackMessage ?? "Request failed.", "network");
  }
};
