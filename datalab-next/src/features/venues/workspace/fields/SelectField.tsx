import { FieldLabel, FIELD_INPUT_CLASSNAME } from './FieldLabel'

type SelectFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
}

/** Edit-mode control: a fixed-choice select. Purely presentational — no validation, no persistence. */
export function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <FieldLabel label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_INPUT_CLASSNAME}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldLabel>
  )
}
