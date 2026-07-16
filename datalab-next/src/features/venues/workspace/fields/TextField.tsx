type TextFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'url' | 'tel'
}

/** Edit-mode control: a single-line text input. Purely presentational — no validation, no persistence. */
export function TextField({ label, value, onChange, type = 'text' }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
      />
    </label>
  )
}
