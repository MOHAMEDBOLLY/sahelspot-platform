import type { Venue } from '../../types/venue'
import { StatusBadge } from '../../components/StatusBadge'

type VenueTableProps = {
  venues: Venue[]
}

export function VenueTable({ venues }: VenueTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Destination</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {venues.map((venue) => (
            <tr key={venue.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{venue.name}</td>
              <td className="px-4 py-3 text-gray-600">{venue.category}</td>
              <td className="px-4 py-3 text-gray-600">{venue.destination_id}</td>
              <td className="px-4 py-3">
                <StatusBadge status={venue.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
