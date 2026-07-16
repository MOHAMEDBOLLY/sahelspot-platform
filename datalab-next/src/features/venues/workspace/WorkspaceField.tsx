import type { ReactNode } from 'react'

type WorkspaceFieldProps = {
  label: string
  value?: ReactNode
}

/** A single "label / value" pair, with a consistent placeholder when a field has no data. */
export function WorkspaceField({ label, value }: WorkspaceFieldProps) {
  const isEmpty = value === null || value === undefined || value === ''

  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">
        {isEmpty ? <span className="text-gray-400 italic">Not set</span> : value}
      </dd>
    </div>
  )
}
