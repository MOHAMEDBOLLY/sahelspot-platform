import type { ReactNode } from 'react'

type FieldLabelProps = {
  label: string
  error?: string
  children: ReactNode
}

export function FieldLabel({ label, error, children }: FieldLabelProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      {children}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}
