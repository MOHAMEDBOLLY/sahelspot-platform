import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type WorkspaceSectionProps = {
  title: string
  icon: LucideIcon
  children: ReactNode
}

/** Card chrome (border, padding, title+icon header) shared by every workspace section. */
export function WorkspaceSection({ title, icon: Icon, children }: WorkspaceSectionProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon size={16} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </section>
  )
}
