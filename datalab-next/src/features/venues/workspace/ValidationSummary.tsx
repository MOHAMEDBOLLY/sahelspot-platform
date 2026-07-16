import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { FieldError, ValidationResult } from '../../../types/validation'

type ValidationSummaryProps = {
  result: ValidationResult
}

type FieldErrorListProps = {
  items: FieldError[]
}

function FieldErrorList({ items }: FieldErrorListProps) {
  return (
    <ul className="mt-1.5 list-disc pl-6">
      {items.map((item) => (
        <li key={item.field}>{item.message}</li>
      ))}
    </ul>
  )
}

/** Renders the backend's editorial readiness response — a top-level
 * ready-for-review banner plus errors/warnings/info, each shown only when
 * present. Purely presentational: it doesn't decide readiness, it displays
 * what the backend (the source of truth) already decided. Warnings and
 * info are empty today, but the layout already supports them so a future
 * backend rule change (see api/app/validation/schemas.py) needs no UI
 * rework — just fields that stop being empty. */
export function ValidationSummary({ result }: ValidationSummaryProps) {
  const { ready_for_review: readyForReview, errors, warnings, info } = result

  return (
    <div className="flex flex-col gap-2">
      {readyForReview ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <CheckCircle2 size={16} className="shrink-0" />
          Ready for review.
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <XCircle size={16} className="shrink-0" />
          Not ready for review.
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <div className="flex items-center gap-2 font-medium">
            <XCircle size={16} className="shrink-0" />
            {errors.length} error{errors.length === 1 ? '' : 's'}
          </div>
          <FieldErrorList items={errors} />
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle size={16} className="shrink-0" />
            {warnings.length} warning{warnings.length === 1 ? '' : 's'}
          </div>
          <FieldErrorList items={warnings} />
        </div>
      )}

      {info.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <div className="flex items-center gap-2 font-medium">
            <Info size={16} className="shrink-0" />
            {info.length} note{info.length === 1 ? '' : 's'}
          </div>
          <FieldErrorList items={info} />
        </div>
      )}
    </div>
  )
}
