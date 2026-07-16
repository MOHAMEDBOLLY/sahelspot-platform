type CheckboxFieldProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/** Edit-mode control: a single boolean toggle. Purely presentational — no validation, no persistence. */
export function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
      />
      <span className="text-sm text-gray-900">{label}</span>
    </label>
  )
}
