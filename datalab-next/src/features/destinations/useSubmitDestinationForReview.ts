import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submitDestinationForReview } from './api'

/** Review — the first editorial state transition (`draft -> review`),
 * same shape as venues' `useSubmitForReview`. */
export function useSubmitDestinationForReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => submitDestinationForReview(id),
    onSuccess: (updatedDestination) => {
      queryClient.setQueryData(['destination', updatedDestination.id], updatedDestination)
      queryClient.invalidateQueries({ queryKey: ['destinations'] })
    },
  })
}
