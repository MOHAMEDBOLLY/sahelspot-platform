import { FieldLabel } from './FieldLabel'
import { fieldInputClassName } from './fieldStyles'

type TextFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'url' | 'tel'
  error?: string
}

/** Edit-mode control: a single-line text input. Presentational — the only
 * validation-awareness it has is rendering an error message/border it's
 * given; it never decides what counts as invalid itself. */
export function TextField({ label, value, onChange, type = 'text', error }: TextFieldProps) {
  return (
    <FieldLabel label={label} error={error}>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldInputClassName(Boolean(error))}
      />
    </FieldLabel>
  )
}
