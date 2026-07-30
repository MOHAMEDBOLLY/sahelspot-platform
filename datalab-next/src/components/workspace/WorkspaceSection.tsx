import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type WorkspaceSectionProps = {
  title: string
  icon: LucideIcon
  children: ReactNode
  /** Optional scroll anchor — used by features like the venue editor's
   * missing-data chips to jump to a section. Omit when nothing needs to
   * link here. */
  id?: string
}

/** Card chrome (border, padding, title+icon header) shared by every
 * workspace section, across every entity's workspace (Venues, Destinations,
 * and future entities). Entity-agnostic — moved to `components/workspace/`
 * in Sprint 21 when Destinations became the second consumer. */
export function WorkspaceSection({ title, icon: Icon, children, id }: WorkspaceSectionProps) {
  return (
    <section id={id} className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon size={16} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </section>
  )
}
