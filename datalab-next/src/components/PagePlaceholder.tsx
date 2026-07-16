import type { LucideIcon } from 'lucide-react'

type PagePlaceholderProps = {
  icon: LucideIcon
  title: string
  description: string
}

export function PagePlaceholder({ icon: Icon, title, description }: PagePlaceholderProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 py-24 text-center">
      <Icon size={28} strokeWidth={1.5} className="text-gray-400" />
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="max-w-sm text-sm text-gray-500">{description}</p>
    </div>
  )
}
