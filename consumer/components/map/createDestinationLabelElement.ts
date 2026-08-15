/** Low-Angle Oblique North Coast View — destination labels shown only
 * while the user presses and holds the map (see `MapView`'s long-press
 * handling). Deliberately not a marker/pin: text + a thin leader line
 * with a small arrowhead pointing at the destination's real coordinate,
 * per the approved concept ("no large pin, no colored marker bubble, no
 * large card").
 *
 * The element is a fixed-size, transparent box whose *center* is the
 * destination's real coordinate (attached with Mapbox's `anchor: "center"`).
 * Everything is drawn relative to that center, so the arrowhead sits exactly
 * on the true location no matter how far the text has been pushed away to
 * avoid a collision — the offset only ever lengthens and angles the leader
 * line, it never relocates the geographic anchor.
 *
 * `pointer-events: none` throughout — these labels are read-only context
 * revealed by the press gesture, never a tap target; opening a
 * destination stays the Destination popover's job, unchanged by this
 * task. */

const SVG_NS = "http://www.w3.org/2000/svg";

/** Big enough to contain the longest name at the furthest candidate offset
 * (see `CANDIDATE_OFFSETS`) without clipping the leader or text. The box is
 * transparent and non-interactive, so overlapping boxes cost nothing. */
const BOX_WIDTH = 660;
const BOX_HEIGHT = 320;
const CENTER_X = BOX_WIDTH / 2;
const CENTER_Y = BOX_HEIGHT / 2;

const INK = "#FBF8F1";
/** Font stack is shared verbatim with `measureDestinationLabelWidth` below
 * so the width the collision solver reasons about is the width that
 * actually renders — a mismatch there would let "separated" labels overlap. */
const LABEL_FONT_SIZE = 13;
const LABEL_FONT_WEIGHT = 600;
const LABEL_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

/** Arrowhead sits tip-on-anchor; these are its dimensions back along the
 * leader. Small on purpose — the concept asks for "a very small arrow
 * head", not a pin. */
const ARROW_LENGTH = 7;
const ARROW_HALF_WIDTH = 3.2;
/** Gap between the leader line's end and the first glyph. */
const TEXT_GAP = 6;

export function createDestinationLabelElement(
  name: string,
  offset: { dx: number; dy: number },
): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `
    width:${BOX_WIDTH}px;
    height:${BOX_HEIGHT}px;
    pointer-events:none;
  `;

  const labelX = CENTER_X + offset.dx;
  const labelY = CENTER_Y + offset.dy;

  // Unit vector pointing from the anchor out toward the label — the
  // arrowhead is built along it so the head always aims *at* the anchor,
  // whatever angle the collision solver chose.
  const length = Math.hypot(offset.dx, offset.dy) || 1;
  const ux = offset.dx / length;
  const uy = offset.dy / length;
  // Perpendicular, for the arrowhead's two base corners.
  const px = -uy;
  const py = ux;

  const baseX = CENTER_X + ux * ARROW_LENGTH;
  const baseY = CENTER_Y + uy * ARROW_LENGTH;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(BOX_WIDTH));
  svg.setAttribute("height", String(BOX_HEIGHT));
  svg.setAttribute("viewBox", `0 0 ${BOX_WIDTH} ${BOX_HEIGHT}`);
  svg.setAttribute("fill", "none");
  svg.style.cssText = "display:block; filter: drop-shadow(0 1px 2px rgba(0,0,0,.7));";

  const leader = document.createElementNS(SVG_NS, "line");
  leader.setAttribute("x1", String(baseX));
  leader.setAttribute("y1", String(baseY));
  leader.setAttribute("x2", String(labelX));
  leader.setAttribute("y2", String(labelY));
  leader.setAttribute("stroke", INK);
  leader.setAttribute("stroke-width", "1.3");
  leader.setAttribute("stroke-linecap", "round");

  const head = document.createElementNS(SVG_NS, "polygon");
  head.setAttribute(
    "points",
    [
      `${CENTER_X},${CENTER_Y}`,
      `${baseX + px * ARROW_HALF_WIDTH},${baseY + py * ARROW_HALF_WIDTH}`,
      `${baseX - px * ARROW_HALF_WIDTH},${baseY - py * ARROW_HALF_WIDTH}`,
    ].join(" "),
  );
  head.setAttribute("fill", INK);

  // A leftward placement (chosen when the anchor sits near the right edge)
  // mirrors the text so it grows away from the leader rather than back
  // across it — the leader/arrow geometry above is direction-agnostic
  // already, so only the text's anchoring side changes.
  const extendsLeft = offset.dx < 0;
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(extendsLeft ? labelX - TEXT_GAP : labelX + TEXT_GAP));
  text.setAttribute("y", String(labelY));
  text.setAttribute("dominant-baseline", "middle");
  text.setAttribute("text-anchor", extendsLeft ? "end" : "start");
  text.setAttribute("fill", INK);
  text.setAttribute("font-size", String(LABEL_FONT_SIZE));
  text.setAttribute("font-weight", String(LABEL_FONT_WEIGHT));
  text.setAttribute("font-family", LABEL_FONT_FAMILY);
  text.setAttribute("letter-spacing", "0.01em");
  // Halo drawn behind the glyphs rather than as a blur, so the text stays
  // legible over both pale sand and dark sea without a box behind it.
  text.setAttribute("stroke", "rgba(0,0,0,0.55)");
  text.setAttribute("stroke-width", "2.6");
  text.setAttribute("paint-order", "stroke");
  text.setAttribute("stroke-linejoin", "round");
  text.textContent = name;

  svg.appendChild(leader);
  svg.appendChild(head);
  svg.appendChild(text);
  el.appendChild(svg);
  return el;
}

let measurementContext: CanvasRenderingContext2D | null = null;

/** Rendered width of a label's text, for the collision solver. Uses a
 * canvas rather than a throwaway DOM node so measuring a dozen labels
 * costs no layout/reflow during the press gesture, and uses the exact font
 * string the SVG above renders with so the two agree. */
export function measureDestinationLabelWidth(name: string): number {
  if (!measurementContext) {
    measurementContext = document.createElement("canvas").getContext("2d");
  }
  if (!measurementContext) {
    // Canvas unavailable (very old browser, or a hardened context) — fall
    // back to a deliberate over-estimate so the solver spaces labels more
    // generously rather than overlapping them.
    return name.length * LABEL_FONT_SIZE * 0.62;
  }
  measurementContext.font = `${LABEL_FONT_WEIGHT} ${LABEL_FONT_SIZE}px ${LABEL_FONT_FAMILY}`;
  return measurementContext.measureText(name).width;
}
