import { formatDateTime } from '../../lib/formatDate'
import type { ActivityLogEntry } from './types'

type ActivityTableProps = {
  entries: ActivityLogEntry[]
}

/** Human-readable labels for the known action strings — falls back to the
 * raw value for anything not yet listed here, so a future action never
 * renders as blank. */
const ACTION_LABELS: Record<string, string> = {
  submit_for_review: 'Submit for Review',
  approve: 'Approve',
  publish: 'Publish',
  republish: 'Republish',
}

export function ActivityTable({ entries }: ActivityTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-4 py-2 font-medium text-gray-500">Timestamp</th>
            <th className="px-4 py-2 font-medium text-gray-500">Action</th>
            <th className="px-4 py-2 font-medium text-gray-500">Entity</th>
            <th className="px-4 py-2 font-medium text-gray-500">Metadata</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="whitespace-nowrap px-4 py-2 text-gray-500">{formatDateTime(entry.timestamp)}</td>
              <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-900">
                {ACTION_LABELS[entry.action] ?? entry.action}
              </td>
              <td className="px-4 py-2 text-gray-700">
                {entry.entity_type} · {entry.entity_id}
              </td>
              <td className="px-4 py-2 text-gray-500">
                {entry.metadata ? (
                  <code className="text-xs">{JSON.stringify(entry.metadata)}</code>
                ) : (
                  <span className="text-gray-400 italic">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
