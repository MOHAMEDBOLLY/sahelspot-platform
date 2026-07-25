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
    throw new ApiError(`${path} failed with status ${response.status}`, response.status)
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
    throw new ApiError(`${path} failed with status ${response.status}`, response.status)
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

/** FastAPI's `HTTPException(detail=...)` can carry a plain string or a
 * structured object — surface whichever message is there instead of the
 * generic "path failed with status N" fallback, since Sprint 14's Review
 * transition (and any future action endpoint) returns a structured
 * `{error, message, ...}` detail on rejection. */
async function extractErrorMessage(response: Response, path: string): Promise<string> {
  try {
    const body: unknown = await response.json()
    const detail = (body as { detail?: unknown } | null)?.detail
    if (typeof detail === 'string') return detail
    if (detail && typeof detail === 'object' && typeof (detail as { message?: unknown }).message === 'string') {
      return (detail as { message: string }).message
    }
  } catch {
    // Response wasn't JSON — fall through to the generic message.
  }
  return `${path} failed with status ${response.status}`
}
