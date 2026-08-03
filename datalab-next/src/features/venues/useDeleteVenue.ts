import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteVenue } from './api'

/** Permanent delete, any status. Unlike every other mutation in this
 * feature, there's no updated venue to seed the cache with — the row is
 * gone — so this removes the single-venue query outright and invalidates
 * the list, rather than calling `setQueryData`. */
export function useDeleteVenue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteVenue(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ['venue', id] })
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}
