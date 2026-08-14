"use client";

/** Remove All Map BottomSheets task — replaces the Categories
 * `BottomSheet` with the shared `ToolbarPopover` shell. Multi-select
 * (Coffee + Beaches at once is valid), so unlike `DestinationPopover`
 * selecting a category does not close the popover — the same "stays
 * open until you dismiss it" behavior the old `BottomSheet` had, and
 * `FilterPopover`'s own tag/access rows already use. Category state
 * (`toggleCategory`) is entirely `MapClient`'s own; only its own
 * contextual filters live behind the separate Filters control — this
 * popover only ever selects categories. */

import { PopoverOptionRow, ToolbarPopover } from "@/components/map/ToolbarPopover";
import type { MapCategory } from "@/lib/home/mapCategories";

type CategoryPopoverProps = {
  open: boolean;
  onClose: () => void;
  categories: readonly MapCategory[];
  selectedCategoryIds: string[];
  onToggleCategory: (id: string) => void;
};

export function CategoryPopover({
  open,
  onClose,
  categories,
  selectedCategoryIds,
  onToggleCategory,
}: CategoryPopoverProps) {
  return (
    <ToolbarPopover maxHeightClass="max-h-[300px]" onClose={onClose} open={open} title="Categories" width="w-60">
      {categories.map((category) => (
        <PopoverOptionRow
          active={selectedCategoryIds.includes(category.id)}
          icon={category.icon}
          key={category.id}
          label={category.label}
          onClick={() => onToggleCategory(category.id)}
        />
      ))}
    </ToolbarPopover>
  );
}
