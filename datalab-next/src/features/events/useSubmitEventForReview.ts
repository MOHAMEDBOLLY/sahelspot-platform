import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submitEventForReview } from './api'

export function useSubmitEventForReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => submitEventForReview(id),
    onSuccess: (event) => {
      queryClient.setQueryData(['event', event.id], event)
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
