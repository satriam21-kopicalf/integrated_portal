// Stock opname calls (/api/so/*): the portal backend passes them to the kopicalf stock-count API (D-51).
// Envelope {data} / {error: {code, message}}; portal errors (session expired, gateway down) are {error: "text"}.

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    credentials: "same-origin",
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = typeof body?.error === "string" ? { message: body.error } : body?.error ?? {};
    if (res.status === 401 && typeof window !== "undefined") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload resets the session state
      window.location.assign(`${window.location.origin}/login?reason=expired&next=${encodeURIComponent(window.location.pathname)}`);
    }
    throw new ApiError(res.status, e.code ?? "ERROR", e.message ?? `Request failed (${res.status})`, e.field);
  }
  return body.data as T;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
