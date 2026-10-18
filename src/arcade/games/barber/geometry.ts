// Géométrie de Barber Rush, en unités du dessin SVG (tête centrée en x = 200, visage de x = 110 à 290).
// Zones de tondeuse et de barbe, tracés de contour, points d'ancrage des ciseaux, mesure des gestes.
import type { ContourKind } from './engine';

export interface Pt {
  x: number;
  y: number;
}

const inEllipse = (p: Pt, cx: number, cy: number, rx: number, ry: number, grow = 0) =>
  ((p.x - cx) / (rx + grow)) ** 2 + ((p.y - cy) / (ry + grow)) ** 2 <= 1;

/** Zones de tondeuse : les deux côtés du crâne, au dessus des oreilles. */
export const CLIP_ZONES = [
  { cx: 113, cy: 182, rx: 22, ry: 44 },
  { cx: 287, cy: 182, rx: 22, ry: 44 },
];

export function inClipZone(p: Pt, grow = 0): boolean {
  return CLIP_ZONES.some((z) => inEllipse(p, z.cx, z.cy, z.rx, z.ry, grow));
}

/** Zone de barbe : bas du visage, sous la ligne des joues, bouche exclue. */
export function inBeardZone(p: Pt, grow = 0): boolean {
  // Sous la ligne des joues (de y = 232 sur les côtés à y = 298 au centre), dans l'ovale du bas du visage.
  const k = Math.min(1, Math.abs(p.x - 200) / 72);
  const top = 298 - 66 * k * k;
  return p.y > top - grow && inEllipse(p, 200, 302, 96, 106, grow) && !inEllipse(p, 200, 320, 22, 9);
}

function grid(test: (p: Pt) => boolean, step: number): Pt[] {
  const out: Pt[] = [];
  for (let y = 60; y <= 420; y += step) for (let x = 60; x <= 340; x += step) if (test({ x, y })) out.push({ x, y });
  return out;
}

export const CLIP_CELLS = grid((p) => inClipZone(p), 8);
export const BEARD_CELLS = grid((p) => inBeardZone(p), 13);
export const CLIP_BRUSH = 17;
export const BEARD_BRUSH = 24;

function sample(points: Pt[], every = 5): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / every));
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  out.push(points[points.length - 1]);
  return out;
}

function quad(a: Pt, c: Pt, b: Pt, n = 16): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  });
}

const mirror = (pts: Pt[]) => pts.map((p) => ({ x: 400 - p.x, y: p.y }));

/** Tracés de contour : un ou deux segments chacun (points de passage). */
export const CONTOUR_SEGMENTS: Record<ContourKind, Pt[][]> = {
  hairline: [quad({ x: 126, y: 168 }, { x: 200, y: 112 }, { x: 274, y: 168 })],
  sideburns: [
    [
      { x: 124, y: 186 },
      { x: 126, y: 246 },
    ],
    mirror([
      { x: 124, y: 186 },
      { x: 126, y: 246 },
    ]),
  ],
  beardline: [
    quad({ x: 128, y: 230 }, { x: 140, y: 280 }, { x: 172, y: 294 }, 10),
    mirror(quad({ x: 128, y: 230 }, { x: 140, y: 280 }, { x: 172, y: 294 }, 10)),
  ],
};

export const CONTOUR_POINTS: Record<ContourKind, Pt[]> = {
  hairline: CONTOUR_SEGMENTS.hairline.flatMap((s) => sample(s)),
  sideburns: CONTOUR_SEGMENTS.sideburns.flatMap((s) => sample(s)),
  beardline: CONTOUR_SEGMENTS.beardline.flatMap((s) => sample(s)),
};

export function distToPoints(p: Pt, pts: Pt[]): number {
  let best = Infinity;
  for (const q of pts) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
  return best;
}

/** Points d'ancrage des ciseaux, le long des pointes de la chevelure. */
export const SNIP_POINTS: Pt[] = [
  { x: 124, y: 132 },
  { x: 140, y: 96 },
  { x: 168, y: 72 },
  { x: 200, y: 64 },
  { x: 232, y: 72 },
  { x: 260, y: 96 },
  { x: 276, y: 132 },
];
export const SNIP_RADIUS = 30;

export function polyPath(pts: Pt[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
}
