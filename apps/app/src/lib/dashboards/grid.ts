import type { DashboardPanel } from "./schema";

const GRID_COLUMNS = 24;
const GRID_ROW_HEIGHT = 32;
const GRID_GAP = 12;
const overlaps = (
  a: Pick<DashboardPanel, "x" | "y" | "w" | "h">,
  b: Pick<DashboardPanel, "x" | "y" | "w" | "h">,
) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Keep the manipulated panel in place; push collisions down deterministically.
const placePanel = (
  panels: DashboardPanel[],
  id: string,
  position: { x: number; y: number; w: number; h: number },
) => {
  const w = Math.max(4, Math.min(GRID_COLUMNS, Math.round(position.w)));
  const h = Math.max(3, Math.min(30, Math.round(position.h)));
  const active = panels.find((panel) => panel.id === id);
  if (!active) return panels;
  const placed = [
    {
      ...active,
      ...position,
      w,
      h,
      x: Math.max(0, Math.min(GRID_COLUMNS - w, Math.round(position.x))),
      y: Math.max(0, Math.min(9000, Math.round(position.y))),
    },
  ];
  for (const panel of panels
    .filter((p) => p.id !== id)
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))) {
    const next = { ...panel };
    let collision;
    while ((collision = placed.find((p) => overlaps(p, next))))
      next.y = collision.y + collision.h;
    placed.push(next);
  }
  return panels.map((panel) => placed.find((p) => p.id === panel.id)!);
};

const nextPosition = (panels: DashboardPanel[], w: number, h: number) => {
  const bottom = Math.max(0, ...panels.map((panel) => panel.y + panel.h));
  for (let y = 0; y <= bottom; y++)
    for (let x = 0; x <= GRID_COLUMNS - w; x++) {
      if (!panels.some((panel) => overlaps(panel, { x, y, w, h })))
        return { x, y, w, h };
    }
  return { x: 0, y: bottom, w, h };
};

export {
  GRID_COLUMNS,
  GRID_ROW_HEIGHT,
  GRID_GAP,
  overlaps,
  placePanel,
  nextPosition,
};
