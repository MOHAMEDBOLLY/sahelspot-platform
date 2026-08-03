import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  bulkApproveVenues,
  bulkArchiveVenues,
  bulkDeleteVenues,
  bulkMoveVenuesToDraft,
  bulkRestoreVenues,
  bulkSubmitVenuesForReview,
  bulkUpdateVenueCategory,
  bulkUpdateVenueDestination,
  bulkValidateVenues,
} from './api'

/** Sprint 28 — Bulk Operations. Five small mutations, grouped in one file
 * since they're introduced together and share the exact same shape (call
 * the bulk endpoint, invalidate the venues list on success — same
 * reasoning `useUpdateVenue`'s Sprint 27 docstring already gives for why
 * list invalidation, not direct cache patching, is correct once the list
 * is keyed by search/filter params). None of these seed the single-venue
 * cache (`['venue', id]`) the way single-item actions do — a bulk action
 * covering many ids has no one venue to seed, and the list refetch is
 * what the bulk toolbar's UI actually reads from.
 */

export function useBulkValidateVenues() {
  return useMutation({
    mutationFn: (venueIds: string[]) => bulkValidateVenues(venueIds),
  })
}

export function useBulkSubmitVenuesForReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (venueIds: string[]) => bulkSubmitVenuesForReview(venueIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  })
}

export function useBulkApproveVenues() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (venueIds: string[]) => bulkApproveVenues(venueIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  })
}

export function useBulkMoveVenuesToDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (venueIds: string[]) => bulkMoveVenuesToDraft(venueIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  })
}

export function useBulkArchiveVenues() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (venueIds: string[]) => bulkArchiveVenues(venueIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  })
}

export function useBulkRestoreVenues() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (venueIds: string[]) => bulkRestoreVenues(venueIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  })
}

export function useBulkDeleteVenues() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (venueIds: string[]) => bulkDeleteVenues(venueIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  })
}

export function useBulkUpdateVenueCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ venueIds, category }: { venueIds: string[]; category: string }) =>
      bulkUpdateVenueCategory(venueIds, category),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  })
}

export function useBulkUpdateVenueDestination() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ venueIds, destinationId }: { venueIds: string[]; destinationId: string }) =>
      bulkUpdateVenueDestination(venueIds, destinationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  })
}
