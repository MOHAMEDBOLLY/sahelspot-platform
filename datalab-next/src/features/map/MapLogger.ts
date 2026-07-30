/**
 * The only sanctioned way to log from inside the Maps feature — no
 * `console.log`/`console.warn`/`console.error` anywhere else under
 * `features/map/`. A thin, prefixed wrapper today; the one place a
 * future change (disable in production, forward to telemetry) would
 * happen without touching every call site.
 */
export const MapLogger = {
  debug(message: string, context?: Record<string, unknown>): void {
    console.debug(`[Map] ${message}`, context ?? '')
  },
  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[Map] ${message}`, context ?? '')
  },
  error(message: string, context?: Record<string, unknown>): void {
    console.error(`[Map] ${message}`, context ?? '')
  },
}
