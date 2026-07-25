import { getAccessToken } from '../features/auth/authService'

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Every mutation route requires a Supabase-issued token as of Sprint 22
 * (see `api/app/auth/dependencies.py`); GETs don't. Goes through
 * `authService.getAccessToken()`, never the Supabase SDK directly — this
 * is the one non-`features/auth/` file that's allowed to know a token
 * exists at all. */
async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`)

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response, path), response.status)
  }

  return response.json() as Promise<T>
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response, path), response.status)
  }

  return response.json() as Promise<T>
}

export async function apiPost<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
  })

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response, path), response.status)
  }

  return response.json() as Promise<T>
}

/** Sprint 25 — media upload. Deliberately not `Content-Type: application/
 * json` like the other verbs: the browser sets `multipart/form-data` (with
 * the correct boundary) itself when the body is a `FormData`, and setting
 * it manually here would omit that boundary and break the request. */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: formData,
  })

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response, path), response.status)
  }

  return response.json() as Promise<T>
}

/** FastAPI's `HTTPException(detail=...)` can carry a plain string or a
 * structured object — surface whichever message is there instead of the
 * generic "path failed with status N" fallback, since Sprint 14's Review
 * transition (and any future action endpoint) returns a structured
 * `{error, message, ...}` detail on rejection. Sprint 24's
 * `require_permission(...)` rejection (`{error: "missing_permission",
 * required: "..."}`) has no `message` field — handled as its own case so
 * a 403 reads as a real sentence, not the generic fallback. */
async function extractErrorMessage(response: Response, path: string): Promise<string> {
  try {
    const body: unknown = await response.json()
    const detail = (body as { detail?: unknown } | null)?.detail
    if (typeof detail === 'string') return detail
    if (detail && typeof detail === 'object') {
      const detailObject = detail as { error?: unknown; message?: unknown }
      if (typeof detailObject.message === 'string') return detailObject.message
      if (detailObject.error === 'missing_permission') {
        return "You don't have permission to perform this action."
      }
    }
  } catch {
    // Response wasn't JSON — fall through to the generic message.
  }
  if (response.status === 403) {
    return "You don't have permission to perform this action."
  }
  return `${path} failed with status ${response.status}`
}
