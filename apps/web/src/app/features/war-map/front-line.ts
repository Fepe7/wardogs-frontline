import type { HexCoord, Sector } from '@frontline/core';
import { HEX_SIZE, hexCenter, type Point } from './hex-layout';

export interface FrontSegment {
  readonly from: Point;
  readonly to: Point;
}

/**
 * Axial neighbours in a pointy-top layout, in the order of their angle (0°, 60°, ...).
 * The border with neighbour k runs between corners k and k+1 (corner k sits at 60k-30°).
 */
const NEIGHBOURS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];
const CORNERS = NEIGHBOURS.length;

const corner = (center: Point, index: number, size: number): Point => {
  const angle = (Math.PI / 180) * (60 * index - 30);
  return { x: center.x + size * Math.cos(angle), y: center.y + size * Math.sin(angle) };
};

const key = ({ q, r }: HexCoord): string => `${String(q)},${String(r)}`;

/**
 * Borders between sectors held by different factions: the front of the war. Each
 * border is drawn once, from the side of the sector listed first.
 */
export const frontLine = (sectors: readonly Sector[], size = HEX_SIZE): FrontSegment[] => {
  const ownerAt = new Map(sectors.map((sector) => [key(sector.coord), sector.owner]));
  const order = new Map(sectors.map((sector, index) => [key(sector.coord), index]));

  return sectors.flatMap((sector, index) => {
    const center = hexCenter(sector.coord, size);
    return NEIGHBOURS.flatMap((step, k) => {
      const neighbour = key({ q: sector.coord.q + step.q, r: sector.coord.r + step.r });
      const owner = ownerAt.get(neighbour);
      const neighbourIndex = order.get(neighbour) ?? -1;
      if (owner === undefined || owner === sector.owner || neighbourIndex < index) return [];
      return [{ from: corner(center, k, size), to: corner(center, (k + 1) % CORNERS, size) }];
    });
  });
};
