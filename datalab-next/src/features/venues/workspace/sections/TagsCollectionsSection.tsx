import { Tags } from 'lucide-react'
import { WorkspaceSection } from '../../../../components/workspace/WorkspaceSection'
import { CheckboxField } from '../../../../components/workspace/fields/CheckboxField'
import { useTags } from '../../../taxonomy/useTags'
import { useCollections } from '../../../taxonomy/useCollections'
import { useUpdateVenueTaxonomy } from '../../useUpdateVenueTaxonomy'
import { LoadingState } from '../../../../components/LoadingState'
import { ApiError } from '../../../../lib/apiClient'
import type { Venue } from '../../../../types/venue'

type TagsCollectionsSectionProps = {
  venue: Venue
  /** Called with the server's response after a successful assignment —
   * same role `commitSave` plays for every other "acts immediately, not
   * part of Save Draft" action in `VenueWorkspace.tsx` (media removal,
   * cover promotion): keeps the workspace's displayed venue in sync with
   * what actually got persisted. */
  onSaved: (venue: Venue) => void
  /** Same "someone else saved since you loaded this" recovery as the
   * Basic Info Save Draft conflict banner (`VenueWorkspace.tsx`'s
   * `handleReloadAfterConflict`) — reused here rather than duplicated,
   * since a stale `version` can just as easily come from this section's
   * own immediate-save calls racing another save. */
  onConflict: () => void
}

/** Category/Tags/Access Type/Badges/Collections architecture (Phase 1) —
 * assignment only, per the approved plan: editors can check/uncheck
 * existing tags and collections, nothing here creates, renames, or deletes
 * either catalog (see `useTags`/`useCollections`' own docstrings for why —
 * Phase 1 has no CRUD UI for either). Saves immediately on each toggle,
 * the same "not part of the Save Draft text-field cycle" pattern
 * `ImagesSection` already established for media actions — there's no
 * separate Edit Mode for this section.
 *
 * Tags are scoped to `venue.category` (`useTags(venue.category)`) — a
 * Coffee tag is never offered on a Restaurant venue, matching the
 * backend's own `validate_tag_ids` enforcement. Known Phase 1 limitation:
 * switching a venue's category (via Basic Information, a separate Save
 * Draft) does not retroactively clear now-mismatched tag assignments —
 * they simply stop appearing checked here (the picker only ever shows the
 * *current* category's catalog) until explicitly reassigned. Acceptable
 * for the approved "keep it simple" Phase 1 scope; not solved here.
 */
export function TagsCollectionsSection({ venue, onSaved, onConflict }: TagsCollectionsSectionProps) {
  const { data: categoryTags, isPending: tagsPending } = useTags(venue.category)
  const { data: collections, isPending: collectionsPending } = useCollections()
  const { mutate: updateTaxonomy, isPending: isSaving, error, reset: resetError } = useUpdateVenueTaxonomy()

  const isConflict = error instanceof ApiError && error.status === 409
  const errorMessage = error instanceof ApiError ? error.message : error ? 'Failed to save.' : null

  function toggleTag(tagId: number, nextChecked: boolean) {
    resetError()
    const currentIds = (categoryTags ?? []).filter((tag) => venue.tags.includes(tag.slug)).map((tag) => tag.id)
    const nextIds = nextChecked ? [...currentIds, tagId] : currentIds.filter((id) => id !== tagId)
    updateTaxonomy(
      { id: venue.id, version: venue.version, patch: { tag_ids: nextIds } },
      { onSuccess: onSaved },
    )
  }

  function toggleCollection(collectionId: string, nextChecked: boolean) {
    resetError()
    // `Collection.id` is its slug (same convention `Destination` already
    // uses), so `venue.collections` — already slugs — doubles as the
    // current id list with no lookup needed.
    const nextIds = nextChecked
      ? [...venue.collections, collectionId]
      : venue.collections.filter((id) => id !== collectionId)
    updateTaxonomy(
      { id: venue.id, version: venue.version, patch: { collection_ids: nextIds } },
      { onSuccess: onSaved },
    )
  }

  return (
    <WorkspaceSection title="Tags & Collections" icon={Tags}>
      {errorMessage && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{errorMessage}</span>
          {isConflict && (
            <button
              type="button"
              onClick={() => {
                resetError()
                onConflict()
              }}
              className="shrink-0 rounded-lg border border-amber-400 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
            >
              Reload
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Tags — {venue.category}
          </h4>
          {tagsPending ? (
            <LoadingState label="Loading tags…" />
          ) : !categoryTags || categoryTags.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No tags defined for this category yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {categoryTags.map((tag) => (
                <CheckboxField
                  key={tag.id}
                  label={tag.label}
                  checked={venue.tags.includes(tag.slug)}
                  onChange={(checked) => toggleTag(tag.id, checked)}
                />
              ))}
            </div>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Collections</h4>
          {collectionsPending ? (
            <LoadingState label="Loading collections…" />
          ) : !collections || collections.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No collections yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {collections.map((collection) => (
                <CheckboxField
                  key={collection.id}
                  label={collection.name}
                  checked={venue.collections.includes(collection.id)}
                  onChange={(checked) => toggleCollection(collection.id, checked)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {isSaving && <p className="mt-3 text-xs text-gray-400">Saving…</p>}
    </WorkspaceSection>
  )
}
