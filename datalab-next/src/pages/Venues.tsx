import { useState } from 'react'
import { VenueListPanel } from '../features/venues/VenueListPanel'
import { VenueWorkspace } from '../features/venues/workspace/VenueWorkspace'

export function Venues() {
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 shrink-0 overflow-y-auto">
        <VenueListPanel selectedVenueId={selectedVenueId} onSelectVenue={setSelectedVenueId} />
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <VenueWorkspace venueId={selectedVenueId} />
      </div>
    </div>
  )
}
