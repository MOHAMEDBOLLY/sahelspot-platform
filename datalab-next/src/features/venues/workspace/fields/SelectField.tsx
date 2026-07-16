type SelectFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
}

/** Edit-mode control: a fixed-choice select. Purely presentational — no validation, no persistence. */
export function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}
