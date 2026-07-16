import { CheckCircle2, XCircle } from 'lucide-react'
import type { ValidationResult } from '../../../types/validation'

type ValidationSummaryProps = {
  result: ValidationResult
}

/** Renders the backend's canonical Validate response — a pass/fail banner
 * plus the structured field errors that caused a failure, if any. Purely
 * presentational: it doesn't decide what's valid, it just displays what the
 * backend (the source of truth) already decided. */
export function ValidationSummary({ result }: ValidationSummaryProps) {
  if (result.valid) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
        <CheckCircle2 size={16} className="shrink-0" />
        Valid — ready for review.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <div className="flex items-center gap-2 font-medium">
        <XCircle size={16} className="shrink-0" />
        {result.errors.length} issue{result.errors.length === 1 ? '' : 's'} found
      </div>
      <ul className="mt-1.5 list-disc pl-6">
        {result.errors.map((error) => (
          <li key={error.field}>{error.message}</li>
        ))}
      </ul>
    </div>
  )
}
