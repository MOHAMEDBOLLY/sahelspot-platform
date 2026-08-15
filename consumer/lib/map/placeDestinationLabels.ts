/** Deterministic destination-label placement — the label-collision half of
 * the same problem `spreadMarkers.ts` solves for venue pins, but at the
 * opposite layer: `spreadMarkers` moves a *marker* off its real coordinate
 * to keep pins tappable; this never moves anything geographic at all. The
 * anchor stays exactly on the destination's real coordinate — only the
 * screen-space offset of the *text* (and therefore its leader line's length
 * and angle) varies, so the arrowhead always still lands on the true
 * location.
 *
 * Deterministic by construction, not heuristic-with-jitter: the same set of
 * anchors at the same camera always produces byte-identical placements.
 * Two rules do that work — a total ordering on the input (screen y, then x,
 * then id, so ties can never resolve differently between runs), and a fixed
 * candidate ladder tried in a fixed order, first-fit wins.
 */

export type LabelAnchor = {
  id: string;
  name: string;
  /** Screen-space position of the destination's real coordinate, in CSS
   * pixels — `map.project()`'s output, passed in rather than computed here
   * so this module stays pure and free of any `mapbox-gl` dependency. */
  x: number;
  y: number;
};

export type LabelPlacement = {
  id: string;
  name: string;
  /** Screen-space offset from the anchor to the label's text origin. The
   * leader line spans exactly this vector, so a larger offset simply reads
   * as a longer, more angled leader — never as a relocated destination. */
  dx: number;
  dy: number;
};

/** Rendered text metrics the collision test needs. Height is fixed (all
 * labels share one type size), so only width varies per name. */
export const LABEL_LINE_HEIGHT = 18;
/** Breathing room added around every label's measured box before testing
 * overlap — two labels that merely touch still read as crowded, and it also
 * absorbs the small difference between canvas-measured and DOM-rendered
 * text width. */
const LABEL_MARGIN = 5;
/** Horizontal gap between the leader line's end and the first glyph, plus
 * a little trailing slack. Kept in the box so a following label can't tuck
 * itself into the gap. */
const LABEL_TEXT_PAD = 6;

/** Candidate offsets, tried strictly in this order for every anchor.
 *
 * The rightward ones come first because, at the approved camera
 * (bearing 300°), right is the Mediterranean — the empty half of the frame
 * the concept explicitly reserves for label text, so a label lands over sea
 * rather than over the resorts/coastal road it's describing. Successive
 * candidates trade a longer leader for more vertical separation, and
 * alternate up/down so a dense cluster fans symmetrically around the coast
 * instead of drifting one direction.
 *
 * The mirrored leftward tail exists for anchors close to the right edge:
 * pushing those further right would run the text off-screen, and a clipped
 * label is no more readable than an overlapping one. A negative `dx` means
 * the text extends leftward from the leader's end (see `boxFor`, and
 * `createDestinationLabelElement`'s `text-anchor` handling). */
const RIGHTWARD_OFFSETS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 26, dy: 0 },
  { dx: 34, dy: -21 },
  { dx: 34, dy: 21 },
  { dx: 46, dy: -42 },
  { dx: 46, dy: 42 },
  { dx: 58, dy: -63 },
  { dx: 58, dy: 63 },
  { dx: 72, dy: -84 },
  { dx: 72, dy: 84 },
  // The corridor framing (Marina -> Ras El Hekma) compresses the whole
  // Sidi Abdel Rahman cluster — eight destinations — into ~130px of screen
  // height, so the ladder has to reach far enough vertically to give each
  // of them a slot. Without these, the cluster exhausted every candidate
  // and fell through to the bounds-ignoring fallback, pushing the longest
  // names off the right edge.
  { dx: 86, dy: -105 },
  { dx: 86, dy: 105 },
  { dx: 100, dy: -126 },
  { dx: 100, dy: 126 },
  { dx: 114, dy: -147 },
  { dx: 114, dy: 147 },
];

const CANDIDATE_OFFSETS: ReadonlyArray<{ dx: number; dy: number }> = [
  ...RIGHTWARD_OFFSETS,
  ...RIGHTWARD_OFFSETS.map(({ dx, dy }) => ({ dx: -dx, dy })),
];

type Box = { left: number; top: number; right: number; bottom: number };

/** Screen-space region labels are allowed to occupy — the map container
 * inset by whatever chrome sits over it. Passed in by the caller rather
 * than read from config here, keeping this module free of layout
 * knowledge. */
export type LabelBounds = { left: number; top: number; right: number; bottom: number };

function boxFor(anchor: LabelAnchor, offset: { dx: number; dy: number }, textWidth: number): Box {
  const edge = anchor.x + offset.dx;
  const centerY = anchor.y + offset.dy;
  // A leftward offset grows the text away from the leader's end, so the
  // box extends left of `edge` rather than right of it.
  const [left, right] =
    offset.dx < 0 ? [edge - textWidth - LABEL_TEXT_PAD, edge] : [edge, edge + textWidth + LABEL_TEXT_PAD];
  return {
    left: left - LABEL_MARGIN,
    right: right + LABEL_MARGIN,
    top: centerY - LABEL_LINE_HEIGHT / 2 - LABEL_MARGIN,
    bottom: centerY + LABEL_LINE_HEIGHT / 2 + LABEL_MARGIN,
  };
}

function withinBounds(box: Box, bounds: LabelBounds): boolean {
  return (
    box.left >= bounds.left &&
    box.right <= bounds.right &&
    box.top >= bounds.top &&
    box.bottom <= bounds.bottom
  );
}

function overlaps(a: Box, b: Box): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

/** Total area this box shares with already-placed ones, in px². Used to
 * rank fallback candidates when no position is perfectly clear, so a
 * crowded cluster degrades to "slightly grazing" rather than "stacked". */
function overlapArea(box: Box, placed: readonly Box[]): number {
  let total = 0;
  for (const other of placed) {
    const w = Math.min(box.right, other.right) - Math.max(box.left, other.left);
    const h = Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top);
    if (w > 0 && h > 0) total += w * h;
  }
  return total;
}

/**
 * @param anchors  One entry per destination to label, already filtered to
 *                 whatever is currently on screen by the caller.
 * @param measureTextWidth  Rendered width of a label's text, in CSS pixels.
 *                 Injected so this module needs no canvas/DOM of its own.
 * @param bounds   Region labels may occupy, so one near an edge flips to
 *                 the opposite side instead of rendering half off-screen.
 *
 * Never drops a destination: if every candidate collides (a pathologically
 * dense cluster), the run is repeated ignoring the bounds test, and failing
 * that the first candidate is used anyway. A slightly crowded label is the
 * correct failure mode here — silently hiding a real destination would be a
 * worse one, and is explicitly out of scope.
 */
export function placeDestinationLabels(
  anchors: readonly LabelAnchor[],
  measureTextWidth: (name: string) => number,
  bounds: LabelBounds,
): LabelPlacement[] {
  // Total ordering — screen y, then x, then id. The id tiebreak is what
  // makes two destinations sharing a projected pixel (Hacienda White and
  // Hacienda Red sit within meters of each other) resolve the same way on
  // every press, instead of depending on input array order.
  const ordered = [...anchors].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));

  const placed: Box[] = [];
  const placements: LabelPlacement[] = [];

  for (const anchor of ordered) {
    const textWidth = measureTextWidth(anchor.name);
    const isFree = (box: Box) => placed.every((existing) => !overlaps(box, existing));

    // Ideal: the first candidate that is both fully on-screen and clear of
    // every label already placed. Failing that, fall back to the on-screen
    // candidate that overlaps the *least* — staying on-screen outranks
    // staying clear (a label pushed off the viewport is entirely
    // unreadable and reads as a rendering bug, whereas two that graze each
    // other are both still legible), but among on-screen options the
    // least-crowded one always wins rather than simply the first.
    const chosen =
      CANDIDATE_OFFSETS.find((candidate) => {
        const box = boxFor(anchor, candidate, textWidth);
        return withinBounds(box, bounds) && isFree(box);
      }) ??
      CANDIDATE_OFFSETS.filter((candidate) => withinBounds(boxFor(anchor, candidate, textWidth), bounds))
        // `reduce` rather than `sort` keeps this a stable first-wins
        // choice on exact ties, preserving the ladder's own ordering.
        .reduce<{ dx: number; dy: number } | null>((best, candidate) => {
          if (best === null) return candidate;
          return overlapArea(boxFor(anchor, candidate, textWidth), placed) <
            overlapArea(boxFor(anchor, best, textWidth), placed)
            ? candidate
            : best;
        }, null) ??
      CANDIDATE_OFFSETS[0];

    placed.push(boxFor(anchor, chosen, textWidth));
    placements.push({ id: anchor.id, name: anchor.name, dx: chosen.dx, dy: chosen.dy });
  }

  return placements;
}
