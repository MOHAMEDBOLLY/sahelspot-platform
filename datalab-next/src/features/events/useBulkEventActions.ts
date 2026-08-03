import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  bulkApproveEvents,
  bulkArchiveEvents,
  bulkDeleteEvents,
  bulkMoveEventsToDraft,
  bulkRestoreEvents,
  bulkSubmitEventsForReview,
} from './api'

export function useBulkSubmitEventsForReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (eventIds: string[]) => bulkSubmitEventsForReview(eventIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
}

export function useBulkApproveEvents() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (eventIds: string[]) => bulkApproveEvents(eventIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
}

export function useBulkMoveEventsToDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (eventIds: string[]) => bulkMoveEventsToDraft(eventIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
}

export function useBulkArchiveEvents() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (eventIds: string[]) => bulkArchiveEvents(eventIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
}

export function useBulkRestoreEvents() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (eventIds: string[]) => bulkRestoreEvents(eventIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
}

export function useBulkDeleteEvents() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (eventIds: string[]) => bulkDeleteEvents(eventIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
}
