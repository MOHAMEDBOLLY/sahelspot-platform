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

/** Every `/editor/*` route requires a Supabase-issued token — the
 * backend's router-level auth gate (`app/api/router.py`) covers reads as
 * well as mutations, not just mutations as an earlier sprint's comment
 * here used to say. Goes through `authService.getAccessToken()`, never
 * the Supabase SDK directly — this is the one non-`features/auth/` file
 * that's allowed to know a token exists at all. */
async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: await authHeaders() })

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response, path), response.status)
  }

  return response.json() as Promise<T>
}

/** EP22 — `extraHeaders` carries `If-Match` for the entities
 * (venues/destinations) `PATCH .../{id}` now requires (PLATFORM_SPEC_
 * v1.0_FROZEN.md §4); every other `PATCH` caller (bulk update) simply
 * omits it, unaffected. */
export async function apiPatch<T>(
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()), ...extraHeaders },
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

/** Sprint 29 — delete. The backend returns `204 No Content` on success
 * (`DELETE /destinations/{id}`), so unlike every other verb here this
 * never calls `response.json()` — there's no body to parse. */
export async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response, path), response.status)
  }
}

/** EP20 — for a `DELETE` whose response has a body (`DELETE .../media`
 * returns the updated `VenueOut`), unlike the `204 No Content` `apiDelete`
 * above already covers. */
export async function apiDeleteJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response, path), response.status)
  }

  return response.json() as Promise<T>
}

/** Sprint 26 — for the rare action that's a `POST` but needs a JSON body
 * (e.g. "set cover to this gallery URL"), rather than the no-body actions
 * `apiPost` already covers (Validate, Submit for Review, Approve). */
export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response, path), response.status)
  }

  return response.json() as Promise<T>
}

/** Sprint 25 — media upload. `XMLHttpRequest`, not `fetch`, is the only
 * reason this can report upload progress at all (`fetch`'s request body
 * doesn't expose progress events in any browser today) — that's the one
 * new requirement Sprint 26's "basic upload progress indication" adds.
 * Deliberately not `Content-Type: application/json` like the other verbs:
 * the browser sets `multipart/form-data` (with the correct boundary)
 * itself for a `FormData` body. */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  onProgress?: (percent: number) => void,
): Promise<T> {
  const headers = await authHeaders()

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}${path}`)
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value)
    }

    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      const status = xhr.status
      if (status >= 200 && status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T)
        } catch {
          reject(new ApiError(`${path} returned an unreadable response.`, status))
        }
        return
      }
      reject(new ApiError(messageFromResponseText(xhr.responseText, status, path), status))
    }

    xhr.onerror = () => {
      reject(new ApiError(`${path} failed — network error.`, 0))
    }

    xhr.send(formData)
  })
}

/** EP20-T01 — export downloads. `/editor/*` routes require a Bearer
 * token, so a plain `<a href>` can't be used (no way to attach the
 * header); this fetches the file authenticated, then triggers the
 * browser's normal save behavior via a throwaway object URL. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: await authHeaders() })

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response, path), response.status)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
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
  const bodyText = await response.text().catch(() => '')
  return messageFromResponseText(bodyText, response.status, path)
}

/** Shared by both `fetch`-based helpers and `apiUpload`'s `XMLHttpRequest`
 * path — the error shape FastAPI returns doesn't depend on which browser
 * API made the request. */
function messageFromResponseText(bodyText: string, status: number, path: string): string {
  try {
    const body: unknown = bodyText ? JSON.parse(bodyText) : null
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
  if (status === 403) {
    return "You don't have permission to perform this action."
  }
  return `${path} failed with status ${status}`
}
