import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QrCode, ChevronRight } from 'lucide-react'
import { fetchNoQrAreas } from '../features/noQr/api'
import { NoQrAreaCreateDialog } from '../features/noQr/NoQrAreaCreateDialog'
import { NoQrAreaDetail } from '../features/noQr/NoQrAreaDetail'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import type { NoQrArea } from '../types/noQrArea'

/** STUDIO — NO QR INDEPENDENT ENTITY (Phase 1). A Walk or Mall is its own
 * editorial entity (`NoQrArea`), NOT a `Venue` — see `api/app/db/
 * models.py`'s `NoQrArea`/`NoQrPlace` docstrings for the full reasoning.
 * Supersedes the Phase 0 approach (`Venue.is_no_qr`/`parent_venue_id`/
 * `no_qr_type`) — those columns are kept, unused, for backward
 * compatibility (see `features/venues/api.ts`'s `updateVenueNoQr`, now
 * dead code, and `BasicInfoSection.tsx`'s "Is No QR Place"/"No QR Type"
 * controls, left alone so the existing Venue editor doesn't break).
 *
 * List + detail within one page via local selection state — same
 * established pattern `pages/Events.tsx` already uses for
 * `EventWorkspace`, not a separate route per Area. */
export function NoQr() {
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null)
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['no-qr-areas'],
    queryFn: fetchNoQrAreas,
  })

  const { walks, malls } = useMemo(() => {
    const areas = data?.items ?? []
    return {
      walks: areas.filter((a) => a.type === 'Walk'),
      malls: areas.filter((a) => a.type === 'Mall'),
    }
  }, [data])

  if (selectedAreaId !== null) {
    return <NoQrAreaDetail areaId={selectedAreaId} onBack={() => setSelectedAreaId(null)} />
  }

  if (isPending) return <LoadingState label="Loading No QR content…" />
  if (isError) {
    return (
      <ErrorState message={error instanceof Error ? error.message : 'Failed to load No QR areas.'} onRetry={refetch} />
    )
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <QrCode size={22} className="text-gray-500" />
            No QR
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Independent discovery areas — Walks and Malls, each its own named container of Places.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <NoQrAreaCreateDialog type="Walk" onCreated={(area) => setSelectedAreaId(area.id)} />
          <NoQrAreaCreateDialog type="Mall" onCreated={(area) => setSelectedAreaId(area.id)} />
        </div>
      </div>

      <AreaGroup title="Walks" areas={walks} emptyMessage="No Walks yet." onOpen={setSelectedAreaId} />
      <AreaGroup title="Malls" areas={malls} emptyMessage="No Malls yet." onOpen={setSelectedAreaId} />
    </div>
  )
}

function AreaGroup({
  title,
  areas,
  emptyMessage,
  onOpen,
}: {
  title: string
  areas: NoQrArea[]
  emptyMessage: string
  onOpen: (id: number) => void
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-gray-500 uppercase">
        {title} ({areas.length})
      </h2>
      {areas.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => onOpen(area.id)}
              className="flex flex-col items-start gap-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:border-gray-300 hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-900">{area.name}</span>
              <span className="text-xs text-gray-400">{area.places.length} Places</span>
              <span className="mt-1 flex items-center gap-1 text-xs font-medium text-blue-600">
                Open
                <ChevronRight size={12} />
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
