import { useMutation } from '@tanstack/react-query'
import { validateVenue } from './api'

/** Triggers the backend's canonical Validate gate on demand. Read-only —
 * doesn't touch the query cache, since validating never changes the venue
 * itself (see api/app/api/routes/venues.py's validate_venue_route). */
export function useValidateVenue() {
  return useMutation({
    mutationFn: (id: string) => validateVenue(id),
  })
}
