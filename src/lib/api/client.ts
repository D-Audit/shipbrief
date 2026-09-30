/**
 * The single HTTP client for the ShipBrief API. Every service in
 * `src/lib/services` goes through here, so base URL, credentials, error
 * parsing and the response envelope are handled in one place.
 *
 * - In the browser, requests go to the same origin (`/api/...`) and are
 *   proxied to the backend by the Next.js rewrite, so the session cookie
 *   stays first-party.
 * - On the server (e.g. `generateMetadata`), requests go straight to
 *   API_INTERNAL_URL.
 */

export type ApiErrorDetails = { path: string; message: string }[];

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: ApiErrorDetails,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiMeta = { page: number; pageSize: number; total: number; hasMore: boolean };

type Envelope<T> =
  | { success: true; data: T; meta?: ApiMeta }
  | { success: false; error: { code: string; message: string; details?: ApiErrorDetails }; requestId?: string };

type Query = Record<string, string | number | boolean | undefined | null>;

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  /** Extra headers (e.g. the anonymous visitor id for public endpoints). */
  headers?: Record<string, string>;
  /** Skip the automatic redirect to /login on 401 (used by the auth screens themselves). */
  allowUnauthenticated?: boolean;
};

const isBrowser = typeof window !== "undefined";

function baseUrl() {
  if (isBrowser) return "";
  return (process.env.API_INTERNAL_URL ?? "http://localhost:4000").replace(/\/$/, "");
}

function buildUrl(path: string, query?: Query) {
  const url = `${baseUrl()}/api${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

function redirectToLogin() {
  if (!isBrowser) return;
  const { pathname, search } = window.location;
  if (!pathname.startsWith("/app") && !pathname.startsWith("/onboarding")) return;
  // A full navigation drops any state that belonged to the expired session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${encodeURIComponent(pathname + search)}`);
}

async function send<T>(path: string, options: RequestOptions = {}): Promise<{ data: T; meta?: ApiMeta }> {
  const { method = "GET", body, query, signal, headers, allowUnauthenticated } = options;
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      signal,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError("We can't reach ShipBrief right now. Check your connection and try again.", "NETWORK_ERROR", 0);
  }

  if (response.status === 204) return { data: undefined as T };

  let envelope: Envelope<T> | undefined;
  try {
    envelope = (await response.json()) as Envelope<T>;
  } catch {
    // Non-JSON body (e.g. a proxy error page).
  }

  if (!response.ok || !envelope || !envelope.success) {
    const error = envelope && !envelope.success ? envelope.error : undefined;
    if (response.status === 401 && !allowUnauthenticated) redirectToLogin();
    throw new ApiError(
      error?.message ?? (response.status >= 500 ? "Something went wrong on our side. Please try again." : "The request couldn't be completed."),
      error?.code ?? "HTTP_ERROR",
      response.status,
      error?.details,
    );
  }
  return { data: envelope.data, meta: envelope.meta };
}

export const api = {
  async get<T>(path: string, options?: Omit<RequestOptions, "method" | "body">) {
    return (await send<T>(path, { ...options, method: "GET" })).data;
  },
  /** GET that also returns pagination metadata. */
  async list<T>(path: string, options?: Omit<RequestOptions, "method" | "body">) {
    return send<T[]>(path, { ...options, method: "GET" });
  },
  async post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) {
    return (await send<T>(path, { ...options, method: "POST", body: body ?? {} })).data;
  },
  async patch<T>(path: string, body: unknown, options?: Omit<RequestOptions, "method" | "body">) {
    return (await send<T>(path, { ...options, method: "PATCH", body })).data;
  },
  async delete<T>(path: string, options?: Omit<RequestOptions, "method" | "body">) {
    return (await send<T>(path, { ...options, method: "DELETE" })).data;
  },
};

/** Downloads a file response (CSV/JSON exports) in the browser. */
export async function downloadFile(path: string, query?: Query) {
  const response = await fetch(buildUrl(path, query), { credentials: "same-origin" });
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as Envelope<never> | null;
    const error = envelope && !envelope.success ? envelope.error : undefined;
    throw new ApiError(error?.message ?? "The download failed.", error?.code ?? "HTTP_ERROR", response.status);
  }
  const filename = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "download";
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return { filename };
}
