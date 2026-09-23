import { areAdjacent, type Faction, type Sector, type SectorId } from '@frontline/core';
import { hexCenter, type Point } from './hex-layout';

export interface AttackArrow {
  readonly fromSectorId: SectorId;
  readonly from: Point;
  readonly to: Point;
}

/** The arrow runs between these fractions of the way from one hex center to the other. */
const ARROW_START = 0.25;
const ARROW_END = 0.8;

const along = (a: Point, b: Point, fraction: number): Point => ({
  x: a.x + (b.x - a.x) * fraction,
  y: a.y + (b.y - a.y) * fraction,
});

const centroid = (points: readonly Point[]): Point => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
  y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
});

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Arrow from the attacker's territory into the sector under attack, so the map shows
 * who attacks without relying on color alone. It starts at the attacker's neighbour
 * closest to the heart of its territory. If the attacker lost every neighbour during
 * the battle there is no arrow; the sector still pulses.
 */
export const attackArrow = (
  sectors: readonly Sector[],
  attack: { readonly sectorId: SectorId; readonly attacker: Faction },
): AttackArrow | null => {
  const target = sectors.find((sector) => sector.id === attack.sectorId);
  if (!target) return null;

  const territory = sectors.filter((sector) => sector.owner === attack.attacker);
  const neighbours = territory.filter((sector) => areAdjacent(sector.coord, target.coord));
  if (neighbours.length === 0) return null;

  const heart = centroid(territory.map((sector) => hexCenter(sector.coord)));
  const [origin] = [...neighbours].sort(
    (a, b) => distance(hexCenter(a.coord), heart) - distance(hexCenter(b.coord), heart),
  );
  if (!origin) return null;

  const from = hexCenter(origin.coord);
  const to = hexCenter(target.coord);
  return {
    fromSectorId: origin.id,
    from: along(from, to, ARROW_START),
    to: along(from, to, ARROW_END),
  };
};
