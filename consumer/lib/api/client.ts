/** The one place an HTTP request to Studio is made. Only ever calls
 * `/public/*` — this app has no authentication and must never call
 * `/editor/*`. Base URL matches `datalab-next`'s `VITE_API_BASE_URL`
 * convention, just under Next.js's `NEXT_PUBLIC_` prefix. */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {}

async function parseJson(response: Response, path: string): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiError(`${path} returned a response that wasn't valid JSON.`);
  }
}

/** GET a JSON array. Every `/public/*` list endpoint returns `[]` rather than
 * an error when no publish revision exists yet — that's an empty state for
 * the UI to render, not something this layer should treat specially. */
export async function apiGetList<T>(path: string): Promise<T[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`);
  } catch {
    throw new ApiError(`Could not reach the API (${path}).`);
  }

  if (!response.ok) {
    throw new ApiError(`${path} failed with status ${response.status}.`);
  }

  const data = await parseJson(response, path);
  if (!Array.isArray(data)) {
    throw new ApiError(`${path} returned an unexpected shape.`);
  }
  return data as T[];
}

/** GET a single resource where a 404 is a legitimate "not found" result, not
 * an error — see docs/adr/0001-public-venue-urls.md. `null` means not found;
 * a network failure, a non-404 non-OK status, or unparseable JSON still
 * throws `ApiError`. */
export async function apiGetOrNull<T>(path: string): Promise<T | null> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`);
  } catch {
    throw new ApiError(`Could not reach the API (${path}).`);
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new ApiError(`${path} failed with status ${response.status}.`);
  }

  return (await parseJson(response, path)) as T;
}
