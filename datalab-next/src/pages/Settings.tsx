import { Settings as SettingsIcon } from 'lucide-react'
import { PagePlaceholder } from '../components/PagePlaceholder'

export function Settings() {
  return (
    <PagePlaceholder
      icon={SettingsIcon}
      title="Settings"
      description="Workspace settings will be built here in a future sprint."
    />
  )
}
