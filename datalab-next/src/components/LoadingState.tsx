import { Loader2 } from 'lucide-react'

type LoadingStateProps = {
  label?: string
}

export function LoadingState({ label = 'Loading…' }: LoadingStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-24 text-center">
      <Loader2 size={24} className="animate-spin text-gray-400" />
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  )
}
