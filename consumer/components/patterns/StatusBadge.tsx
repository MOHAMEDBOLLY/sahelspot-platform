type StatusBadgeProps = {
  isOpen: boolean;
};

/** OPEN / CLOSED badge on every VenueCard — present in the Home export but
 * absent from the handoff prose entirely. Derived from `opening_hours`;
 * see docs/consumer/API_REQUIREMENTS.md §7. */
export function StatusBadge({ isOpen }: StatusBadgeProps) {
  return (
    <span
      className={`rounded-lg px-2 py-1 text-xs font-bold ${
        isOpen ? "bg-secondary/10 text-secondary" : "bg-on-surface-variant/10 text-on-surface-variant"
      }`}
    >
      {isOpen ? "OPEN" : "CLOSED"}
    </span>
  );
}
