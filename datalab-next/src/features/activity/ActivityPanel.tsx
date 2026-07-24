import { Activity as ActivityIcon } from 'lucide-react'
import { useActivity } from './useActivity'
import { ActivityTable } from './ActivityTable'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import { PagePlaceholder } from '../../components/PagePlaceholder'

export function ActivityPanel() {
  const { data, isPending, isError, error, refetch } = useActivity()

  if (isPending) {
    return <LoadingState label="Loading activity…" />
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load activity.'}
        onRetry={() => refetch()}
      />
    )
  }

  if (!data || data.length === 0) {
    return (
      <PagePlaceholder
        icon={ActivityIcon}
        title="No activity yet"
        description="Editorial actions (Submit for Review, Approve, Publish, Republish) will appear here as they happen."
      />
    )
  }

  return <ActivityTable entries={data} />
}
