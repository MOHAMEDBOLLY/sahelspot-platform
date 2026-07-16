type TextAreaFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
}

/** Edit-mode control: a multi-line text area. Purely presentational — no validation, no persistence. */
export function TextAreaField({ label, value, onChange }: TextAreaFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="resize-y rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
      />
    </label>
  )
}
