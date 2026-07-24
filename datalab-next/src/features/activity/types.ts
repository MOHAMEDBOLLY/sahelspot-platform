/** Mirrors the backend's ActivityLogEntryOut (api/app/api/schemas.py) —
 * observability only, this feature never writes anything. */
export interface ActivityLogEntry {
  id: number
  timestamp: string
  action: string
  entity_type: string
  entity_id: string
  actor: string
  metadata: Record<string, unknown> | null
}
