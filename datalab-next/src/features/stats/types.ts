/** Mirrors the backend's PlatformStatsOut (api/app/api/schemas.py) —
 * PLATFORM_SPEC_v1.0_FROZEN.md §2.9, the Dashboard's data source. Every
 * field is computed live server-side; nothing here is cached/stored. */
export interface PlatformStats {
  venues: number
  destinations: number
  categories: number
  with_cover: number
  with_instagram: number
  with_website: number
  with_phone: number
  pct_cover: number
  pct_instagram: number
}
