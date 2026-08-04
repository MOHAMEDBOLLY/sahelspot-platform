/** Cluster bubble — circular, white border, soft shadow, size scales with
 * count, centered count label. Navy for "All", category color when a filter
 * is active (`color` is passed in by the caller, which already knows the
 * active filter). Plain DOM, matching every other marker factory in this
 * module — Mapbox GL markers are DOM elements, not React. */
export function createClusterElement(count: number, color: string): HTMLButtonElement {
  const size = count < 10 ? 36 : count < 50 ? 44 : count < 100 ? 52 : 60;
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `${count} places`);
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "9999px";
  el.style.border = "3px solid white";
  el.style.background = color;
  el.style.boxShadow = "0 4px 14px rgb(0 0 0 / 0.25)";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.cursor = "pointer";
  el.style.padding = "0";
  el.style.transition = "transform 200ms ease, opacity 200ms ease";
  el.style.transform = "scale(0.6)";
  el.style.opacity = "0";
  // Scale/fade in on the next frame — the "dissolve into markers" feel,
  // driven by a CSS transition rather than a custom animation loop.
  requestAnimationFrame(() => {
    el.style.transform = "scale(1)";
    el.style.opacity = "1";
  });

  const label = document.createElement("span");
  label.textContent = String(count);
  label.style.color = "white";
  label.style.fontWeight = "700";
  label.style.fontSize = count < 100 ? "14px" : "12px";
  label.setAttribute("aria-hidden", "true");
  el.appendChild(label);

  return el;
}
