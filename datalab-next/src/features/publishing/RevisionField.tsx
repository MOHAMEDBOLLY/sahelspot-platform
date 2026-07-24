import type { ReactNode } from 'react'

type RevisionFieldProps = {
  label: string
  value?: ReactNode
}

/** A single read-only "label / value" pair — this feature has no edit mode,
 * so unlike the Venue Workspace's WorkspaceField there is no edit-mode
 * counterpart to pair it with. */
export function RevisionField({ label, value }: RevisionFieldProps) {
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
