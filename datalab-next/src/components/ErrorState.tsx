import { AlertTriangle } from 'lucide-react'

type ErrorStateProps = {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-red-200 bg-red-50 py-24 text-center">
      <AlertTriangle size={24} className="text-red-400" />
      <p className="text-sm font-medium text-red-700">Something went wrong</p>
      <p className="max-w-sm text-sm text-red-600">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
        >
          Try again
        </button>
      )}
    </div>
  )
}
