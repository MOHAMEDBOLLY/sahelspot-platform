"use client";

/** Remove All Map BottomSheets task — replaces the Destinations
 * `BottomSheet` with the shared `ToolbarPopover` shell. Single-select
 * (a venue has exactly one destination, "All" is the explicit reset),
 * so — unlike Categories' multi-select — picking a destination closes
 * the popover immediately; there's nothing left to toggle in the same
 * visit. State/camera logic (`changeDestination`, its `flyTo`) is
 * entirely `MapClient`'s own, called here, never duplicated.
 *
 * Final scroll fix — the destination list (12 real destinations) no
 * longer displays in full: the scrollable body is capped to roughly
 * three rows (`max-h-[112px]`, ~34px/row including the `space-y-0.5`
 * gap), everything past that reachable by scrolling the list only —
 * `ToolbarPopover`'s header stays fixed above it, and the Map/page/
 * BottomNav never move. On open, the currently active destination (if
 * any) is scrolled into view within that list — `scrollIntoView({block:
 * "nearest"})` rather than `"center"`/`"start"`, so a destination that's
 * already visible doesn't cause a jump, and one further down only
 * scrolls the minimum needed to reveal it. */

import { useEffect, useRef } from "react";
import { PopoverOptionRow, ToolbarPopover } from "@/components/map/ToolbarPopover";
import type { Destination } from "@/lib/domain/destination";

type DestinationPopoverProps = {
  open: boolean;
  onClose: () => void;
  destinationId: string | "all";
  destinations: Destination[];
  onSelect: (id: string | "all") => void;
};

export function DestinationPopover({
  open,
  onClose,
  destinationId,
  destinations,
  onSelect,
}: DestinationPopoverProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) activeRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  function select(id: string | "all") {
    onSelect(id);
    onClose();
  }

  return (
    <ToolbarPopover
      listRef={listRef}
      maxHeightClass="max-h-[112px]"
      onClose={onClose}
      open={open}
      title="Destinations"
      width="w-60"
    >
      <PopoverOptionRow
        active={destinationId === "all"}
        label="All"
        onClick={() => select("all")}
        rowRef={destinationId === "all" ? activeRowRef : undefined}
      />
      {destinations.map((destination) => (
        <PopoverOptionRow
          active={destinationId === destination.id}
          key={destination.id}
          label={destination.name}
          onClick={() => select(destination.id)}
          rowRef={destinationId === destination.id ? activeRowRef : undefined}
        />
      ))}
    </ToolbarPopover>
  );
}
