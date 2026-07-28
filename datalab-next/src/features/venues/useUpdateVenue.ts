import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateVenue, type VenuePatch } from './api'

/**
 * Save Draft's mutation. On success, seeds the single-venue cache with the
 * server's response (the source of truth for what actually got saved),
 * rather than trusting the local draft — the API may normalize values
 * (e.g. numeric formatting) the client didn't.
 *
 * Sprint 27 — the venues *list* cache is now keyed by search/filter params
 * (`['venues', params]`), so there's no single canonical array left to
 * patch in place: a saved change might match a different filter than
 * whatever's currently on screen. `invalidateQueries` with the shared
 * `['venues']` prefix refetches every currently-mounted list query
 * (TanStack's partial key matching), so whatever's visible reflects the
 * save.
 */
export function useUpdateVenue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, version, patch }: { id: string; version: number; patch: VenuePatch }) =>
      updateVenue(id, version, patch),
    onSuccess: (updatedVenue) => {
      queryClient.setQueryData(['venue', updatedVenue.id], updatedVenue)
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}
