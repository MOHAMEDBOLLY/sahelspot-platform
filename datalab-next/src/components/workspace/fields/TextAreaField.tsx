import { FieldLabel } from './FieldLabel'
import { fieldInputClassName } from './fieldStyles'

type TextAreaFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
}

/** Edit-mode control: a multi-line text area. Presentational — the only
 * validation-awareness it has is rendering an error message/border it's
 * given; it never decides what counts as invalid itself. */
export function TextAreaField({ label, value, onChange, error }: TextAreaFieldProps) {
  return (
    <FieldLabel label={label} error={error}>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className={`resize-y ${fieldInputClassName(Boolean(error))}`}
      />
    </FieldLabel>
  )
}
