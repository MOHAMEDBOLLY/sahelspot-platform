/**
 * Every map event name used anywhere in the Maps feature — no file may
 * write a raw event string (`'load'`, `'click'`, ...) directly, even
 * inside the adapter. `MapboxAdapter` is the only place these get
 * translated into calls against the underlying SDK's own `.on(...)`.
 */
export const MapEvent = {
  Load: 'load',
  Click: 'click',
  /** Map UX Polish — drives per-feature `hover` feature-state (see
   * `MapboxAdapter.onHover`); mirrors `Click`'s layer-delegated form. */
  MouseMove: 'mousemove',
  MouseLeave: 'mouseleave',
  MoveEnd: 'moveend',
  Zoom: 'zoom',
  StyleLoaded: 'styledata',
  /** Phase 3 — fires once panning/zooming/data-loading settles; the
   * source for the `MapIdle` interaction event. */
  Idle: 'idle',
} as const

export type MapEvent = (typeof MapEvent)[keyof typeof MapEvent]
