import type { ApiError, ApiErrorCode, LeadSubmitResponse } from '@bionex/shared/lead';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'network',
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

const NETWORK_MESSAGE = 'Интернет алоқасини текширинг ва қайта уриниб кўринг.';

/**
 * A timeout signal that works on old phones. `AbortSignal.timeout()` only exists since
 * Safari 16 / Chrome 103: on an iPhone with iOS 15 calling it throws, and every order
 * would fail with a "network" error.
 */
function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortController === 'undefined') return undefined;
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
      signal: init.signal ?? timeoutSignal(20_000),
    });
  } catch {
    throw new ApiRequestError(0, 'network', NETWORK_MESSAGE);
  }
  if (res.status === 204) return undefined as T;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON (e.g. a proxy error page).
  }
  if (!res.ok) {
    const err = (body as ApiError | null)?.error;
    throw new ApiRequestError(
      res.status,
      err?.code ?? 'internal',
      err?.message ?? 'Кутилмаган хатолик юз берди. Илтимос, қайта уриниб кўринг.',
      err?.fields,
    );
  }
  return body as T;
}

export function submitLead(body: unknown): Promise<LeadSubmitResponse> {
  return apiFetch<LeadSubmitResponse>('/api/leads', { method: 'POST', body: JSON.stringify(body) });
}

/**
 * A random id for one order attempt (UUID v4). `crypto.randomUUID` only exists since
 * iOS 15.4 / Chrome 92, so older phones build it from `getRandomValues` (available everywhere).
 */
export function newSubmissionId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
