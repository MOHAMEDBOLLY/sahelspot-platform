type StatTileProps = {
  value: string | number;
  label: string;
  /** Each tile in the export carries its own accent — Places navy, Dining
   * teal, Beaches a lighter blue, Events gold. Not a uniform tile. */
  accent?: "primary" | "secondary" | "info" | "tertiary";
  /** One tile in the Map bottom sheet renders highlighted (cream/gold),
   * matching whichever stat is most notable for that destination. */
  highlighted?: boolean;
};

const ACCENTS: Record<NonNullable<StatTileProps["accent"]>, string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  info: "text-sky-600",
  tertiary: "text-tertiary",
};

/** Number-over-label stacked tile, `grid-cols-4` in the Map bottom sheet. */
export function StatTile({
  value,
  label,
  accent = "primary",
  highlighted = false,
}: StatTileProps) {
  return (
    <div
      className={`flex flex-col items-center gap-0.5 rounded-2xl px-2 py-3 ${
        highlighted ? "bg-cream" : "bg-surface-container-low"
      }`}
    >
      <span className={`text-lg font-bold ${highlighted ? "text-tertiary" : ACCENTS[accent]}`}>
        {value}
      </span>
      <span className="text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
        {label}
      </span>
    </div>
  );
}
