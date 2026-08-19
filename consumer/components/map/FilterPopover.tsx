"use client";

/** Compact Map Filters task — replaces the Filters trigger's old
 * `BottomSheet` (which covered up to 70% of the Map) with the shared
 * `ToolbarPopover` shell (Remove All Map BottomSheets task) that
 * Destinations/Categories now use too, so all three toolbar controls
 * read as one floating-popover system. Not built on the provided Radix
 * `Select` reference — this repo has no `@radix-ui/*`, no shadcn
 * `components/ui` primitives, and no `class-variance-authority`
 * (verified via `package.json`/`node_modules` before writing this), and
 * the reference `Select` is a single-value primitive that would have to
 * be fought to stay multi-select.
 *
 * State is 100% owned by `MapClient` — `selectedTagsByCategory`,
 * `selectedAccessTypes`, `toggleTag`/`toggleAccessType`,
 * `contextualFilterCount` are all passed in, not reimplemented. The only
 * state local to this component is which category is currently drilled
 * into (`activeSection`), purely a presentation concern that resets each
 * time the popover closes. */

import { useEffect, useState } from "react";
import { PopoverOptionRow, ToolbarPopover } from "@/components/map/ToolbarPopover";
import { Icon } from "@/components/ui/Icon";
import { ACCESS_TYPE_CATEGORY_ID, type MapCategory } from "@/lib/home/mapCategories";
import { topTags } from "@/lib/domain/tags";
import { ACCESS_TYPES, ACCESS_TYPE_ICON, type AccessType } from "@/lib/domain/accessType";
import type { Venue } from "@/lib/domain/venue";

const MAP_TAG_COUNT = 10;

type FilterPopoverProps = {
  open: boolean;
  onClose: () => void;
  categories: readonly MapCategory[];
  selectedCategoryIds: string[];
  destinationVenues: Venue[];
  selectedTagsByCategory: Record<string, string[]>;
  selectedAccessTypes: AccessType[];
  onToggleTag: (categoryId: string, slug: string) => void;
  onToggleAccessType: (value: AccessType) => void;
};

type Section = {
  categoryId: string;
  label: string;
  tagOptions: { slug: string; label: string }[];
  showAccessType: boolean;
  activeCount: number;
};

export function FilterPopover({
  open,
  onClose,
  categories,
  selectedCategoryIds,
  destinationVenues,
  selectedTagsByCategory,
  selectedAccessTypes,
  onToggleTag,
  onToggleAccessType,
}: FilterPopoverProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Each selected category's own contextual options — same derivation
  // `MapClient`'s old inline BottomSheet content used (`topTags` scoped to
  // this category's venues within the current destination, filtered to
  // `allowedTags`; Access Type only for the Beaches-only
  // `ACCESS_TYPE_CATEGORY_ID`), just computed here instead of inline JSX.
  const sections: Section[] = selectedCategoryIds
    .map((categoryId): Section | null => {
      const mapCategory = categories.find((candidate) => candidate.id === categoryId);
      if (!mapCategory) return null;
      const categoryVenues = destinationVenues.filter((venue) =>
        mapCategory.categories.includes(venue.category),
      );
      const tagOptions = mapCategory.allowedTags
        ? topTags(categoryVenues, MAP_TAG_COUNT).filter((tag) => mapCategory.allowedTags!.includes(tag.slug))
        : [];
      const showAccessType = categoryId === ACCESS_TYPE_CATEGORY_ID;
      if (tagOptions.length === 0 && !showAccessType) return null;
      const activeCount =
        (selectedTagsByCategory[categoryId] ?? []).length + (showAccessType ? selectedAccessTypes.length : 0);
      return { categoryId, label: mapCategory.label, tagOptions, showAccessType, activeCount };
    })
    .filter((section): section is Section => section !== null);

  // Single contextual section: skip the intermediate list, land straight
  // in its options — the extra tap a "Coffee ›" row would cost has no
  // payoff when there's nothing else to choose between. Multiple sections
  // still get the drill-in list (task's own hierarchical requirement).
  const autoSection = sections.length === 1 ? sections[0].categoryId : null;
  const openSection = sections.find((section) => section.categoryId === (activeSection ?? autoSection));

  useEffect(() => {
    if (!open) setActiveSection(null);
  }, [open]);

  if (sections.length === 0) {
    return (
      <ToolbarPopover onClose={onClose} open={open} title="Filters">
        <p className="px-1 py-1 text-xs text-on-surface-variant">Select a category first to see its filters.</p>
      </ToolbarPopover>
    );
  }

  if (openSection) {
    return (
      <ToolbarPopover
        // Back only makes sense once there's a list to return to — the
        // single-section case (`autoSection`) has no list, so this stays
        // a plain title row with just a close button.
        backLabel="Back to filter categories"
        onBack={sections.length > 1 ? () => setActiveSection(null) : undefined}
        onClose={onClose}
        open={open}
        title={openSection.label}
      >
        {openSection.tagOptions.map((tag) => (
          <PopoverOptionRow
            active={(selectedTagsByCategory[openSection.categoryId] ?? []).includes(tag.slug)}
            key={tag.slug}
            label={tag.label}
            onClick={() => onToggleTag(openSection.categoryId, tag.slug)}
          />
        ))}
        {openSection.showAccessType ? (
          <>
            {openSection.tagOptions.length > 0 ? (
              <p className="px-2 pt-1.5 pb-0.5 text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase">
                Access
              </p>
            ) : null}
            {ACCESS_TYPES.map((value) => (
              <PopoverOptionRow
                active={selectedAccessTypes.includes(value)}
                icon={ACCESS_TYPE_ICON[value]}
                key={value}
                label={value}
                onClick={() => onToggleAccessType(value)}
              />
            ))}
          </>
        ) : null}
      </ToolbarPopover>
    );
  }

  return (
    <ToolbarPopover onClose={onClose} open={open} title="Filters">
      {sections.map((section) => (
        <button
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          key={section.categoryId}
          onClick={() => setActiveSection(section.categoryId)}
          type="button"
        >
          <span className="min-w-0 flex-1 truncate">{section.label}</span>
          {section.activeCount > 0 ? (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {section.activeCount}
            </span>
          ) : null}
          <Icon className="text-on-surface-variant" name="chevron_right" size={16} />
        </button>
      ))}
    </ToolbarPopover>
  );
}
