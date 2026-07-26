import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateUserRole } from './api'

/** Sprint 32 — same invalidate-the-list shape every other list-backed
 * mutation in this codebase uses (e.g. `useCreateDestination`,
 * `useDeleteDestination`): no optimistic update, just refetch `['users']`
 * on success so the table reflects the server's own response. */
export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
