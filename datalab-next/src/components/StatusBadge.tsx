type StatusBadgeProps = {
  status: string
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  review: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-gray-100 text-gray-500',
}

const DEFAULT_STYLE = 'bg-gray-100 text-gray-700'

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] ?? DEFAULT_STYLE}`}
    >
      {status}
    </span>
  )
}
