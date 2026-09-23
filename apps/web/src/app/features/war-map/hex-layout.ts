import type { HexCoord } from '@frontline/core';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Distance from a hex center to its corners, in SVG user units. */
export const HEX_SIZE = 10;
const SQRT3 = Math.sqrt(3);

/** Center of an axial hex in a pointy-top layout (redblobgames.com/grids/hexagons). */
export const hexCenter = ({ q, r }: HexCoord, size = HEX_SIZE): Point => ({
  x: size * (SQRT3 * q + (SQRT3 / 2) * r),
  y: size * (3 / 2) * r,
});

/** The six corners of a pointy-top hex, as an SVG `points` attribute. */
export const hexPoints = (coord: HexCoord, size = HEX_SIZE): string => {
  const center = hexCenter(coord, size);
  return Array.from({ length: 6 }, (_, corner) => {
    const angle = (Math.PI / 180) * (60 * corner - 30);
    const x = center.x + size * Math.cos(angle);
    const y = center.y + size * Math.sin(angle);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
};

/** SVG viewBox that fits every hex with a margin. */
export const viewBoxFor = (coords: readonly HexCoord[], size = HEX_SIZE): string => {
  if (coords.length === 0) return '0 0 0 0';
  const centers = coords.map((coord) => hexCenter(coord, size));
  const margin = size * 1.5;
  const minX = Math.min(...centers.map((c) => c.x)) - margin;
  const minY = Math.min(...centers.map((c) => c.y)) - margin;
  const width = Math.max(...centers.map((c) => c.x)) - minX + margin;
  const height = Math.max(...centers.map((c) => c.y)) - minY + margin;
  return [minX, minY, width, height].map((n) => n.toFixed(2)).join(' ');
};
