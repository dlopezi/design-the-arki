export type Rect = { x: number; y: number; width: number; height: number };
export type Margins = { top: number; right: number; bottom: number; left: number };
export type Viewport = { x: number; y: number; zoom: number };

/**
 * The viewport that shows `bounds` as large as possible inside the free area left by the margins, centred in that area.
 * React Flow's own fitView centres on the whole screen and only shifts to respect the margins,
 * so with very different margins (a side panel, a tall results drawer) the diagram sits off-centre.
 */
export function viewportInArea(bounds: Rect, width: number, height: number, margins: Margins, minZoom: number, maxZoom: number): Viewport {
  const areaWidth = Math.max(1, width - margins.left - margins.right);
  const areaHeight = Math.max(1, height - margins.top - margins.bottom);
  const zoom = Math.min(maxZoom, Math.max(minZoom, Math.min(areaWidth / bounds.width, areaHeight / bounds.height)));
  const centreX = margins.left + areaWidth / 2;
  const centreY = margins.top + areaHeight / 2;
  return { x: centreX - (bounds.x + bounds.width / 2) * zoom, y: centreY - (bounds.y + bounds.height / 2) * zoom, zoom };
}
