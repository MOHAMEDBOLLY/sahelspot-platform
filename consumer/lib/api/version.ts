import { apiGetOrNull } from "./client";

/** Mirrors the backend's `GET /version` response — `version.json` (single
 * source of truth, lives in `api/`) returned verbatim. Same shape Studio
 * consumes; this app must not keep its own copy of version info. */
export interface VersionInfo {
  consumer_version: string;
  studio_version: string;
  backend_version: string;
  environment: string;
  git_commit: string;
  last_deployment: string;
  publish_revision: number;
  schema_revision: string;
}

/** `GET /version` — unauthenticated, like every other call this app makes. */
export async function getVersionInfo(): Promise<VersionInfo | null> {
  return apiGetOrNull<VersionInfo>("/version");
}
