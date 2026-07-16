import { FieldLabel, FIELD_INPUT_CLASSNAME } from './FieldLabel'

type TextAreaFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
}

/** Edit-mode control: a multi-line text area. Purely presentational — no validation, no persistence. */
export function TextAreaField({ label, value, onChange }: TextAreaFieldProps) {
  return (
    <FieldLabel label={label}>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className={`resize-y ${FIELD_INPUT_CLASSNAME}`}
      />
    </FieldLabel>
  )
}
