import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  bulkArchiveDestinations,
  bulkDeleteDestinations,
  bulkMoveDestinationsToDraft,
  bulkRestoreDestinations,
} from './api'

/** Destination Lifecycle Management — Bulk Operations. Same shape as
 * venues' `useBulkVenueActions.ts`: call the bulk endpoint, invalidate the
 * destinations list on success. No single-destination cache seeding — a
 * bulk action covering many ids has no one destination to seed, same
 * reasoning venues' bulk hooks already give.
 */

export function useBulkMoveDestinationsToDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (destinationIds: string[]) => bulkMoveDestinationsToDraft(destinationIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['destinations'] }),
  })
}

export function useBulkArchiveDestinations() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (destinationIds: string[]) => bulkArchiveDestinations(destinationIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['destinations'] }),
  })
}

export function useBulkRestoreDestinations() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (destinationIds: string[]) => bulkRestoreDestinations(destinationIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['destinations'] }),
  })
}

export function useBulkDeleteDestinations() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (destinationIds: string[]) => bulkDeleteDestinations(destinationIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['destinations'] }),
  })
}
