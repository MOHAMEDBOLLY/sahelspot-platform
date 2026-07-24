import { History } from 'lucide-react'
import { useRevisions } from './useRevisions'
import { RevisionList } from './RevisionList'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import { PagePlaceholder } from '../../components/PagePlaceholder'

type RevisionListPanelProps = {
  selectedRevisionId: number | null
  onSelectRevision: (id: number) => void
}

export function RevisionListPanel({ selectedRevisionId, onSelectRevision }: RevisionListPanelProps) {
  const { data, isPending, isError, error, refetch } = useRevisions()

  if (isPending) {
    return <LoadingState label="Loading revisions…" />
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load revisions.'}
        onRetry={() => refetch()}
      />
    )
  }

  if (!data || data.length === 0) {
    return (
      <PagePlaceholder
        icon={History}
        title="Nothing published yet"
        description="Revisions will appear here once content has been published."
      />
    )
  }

  return <RevisionList revisions={data} selectedRevisionId={selectedRevisionId} onSelectRevision={onSelectRevision} />
}
