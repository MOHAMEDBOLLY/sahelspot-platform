import { FieldLabel, FIELD_INPUT_CLASSNAME } from './FieldLabel'

type TextFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'url' | 'tel'
}

/** Edit-mode control: a single-line text input. Purely presentational — no validation, no persistence. */
export function TextField({ label, value, onChange, type = 'text' }: TextFieldProps) {
  return (
    <FieldLabel label={label}>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_INPUT_CLASSNAME}
      />
    </FieldLabel>
  )
}
