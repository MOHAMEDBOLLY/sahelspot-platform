type StatTileProps = {
  value: string | number;
  label: string;
  /** The export originally gave each tile its own decorative accent (navy,
   * teal, blue, gold). Retired under the frozen SahelSpot Mobile 2027 Design
   * System — stats are informational, not actionable, so they carry no
   * accent color; the prop is kept for API compatibility but every option
   * now resolves to a neutral or navy token, never the yellow accent. */
  accent?: "primary" | "secondary" | "info" | "tertiary";
  /** One tile in the Map bottom sheet renders highlighted (cream/accent),
   * matching whichever stat is most notable for that destination. This is
   * the one legitimate emphasis use — the yellow accent's job here is to
   * draw the eye to a single called-out stat. */
  highlighted?: boolean;
};

const ACCENTS: Record<NonNullable<StatTileProps["accent"]>, string> = {
  primary: "text-primary",
  secondary: "text-on-surface-variant",
  info: "text-on-surface-variant",
  tertiary: "text-on-surface-variant",
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
        highlighted ? "bg-accent-container" : "bg-surface-container-low"
      }`}
    >
      <span className={`text-lg font-bold ${highlighted ? "text-on-accent" : ACCENTS[accent]}`}>
        {value}
      </span>
      <span className="text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
        {label}
      </span>
    </div>
  );
}
