import type { ReactNode } from 'react'

/** Shared by every edit-mode input control — keeps the label markup and base
 * input styling in one place instead of repeated per field type. */
export const FIELD_INPUT_CLASSNAME =
  'rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none'

type FieldLabelProps = {
  label: string
  children: ReactNode
}

export function FieldLabel({ label, children }: FieldLabelProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  )
}
