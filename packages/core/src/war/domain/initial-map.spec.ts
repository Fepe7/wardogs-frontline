import { describe, expect, it } from 'vitest';
import { FACTIONS, type Faction } from '../../shared/domain/faction';
import { areAdjacent, hexKey } from './hex-coord';
import { initialWarMap } from './initial-map';
import { attackableSectors, type Sector } from './war-map';

const map = initialWarMap();
const territoryOf = (faction: Faction) => map.filter((sector) => sector.owner === faction);

/** Every sector of the territory can be reached from any other without leaving it. */
const isConnected = (territory: readonly Sector[]): boolean => {
  const [first] = territory;
  if (!first) return false;
  const reached = new Set([first.id]);
  const frontier = [first];
  for (let current = frontier.pop(); current; current = frontier.pop()) {
    for (const next of territory) {
      if (!reached.has(next.id) && areAdjacent(current.coord, next.coord)) {
        reached.add(next.id);
        frontier.push(next);
      }
    }
  }
  return reached.size === territory.length;
};

const distanceFromCenter = ({ coord: { q, r } }: Sector) =>
  Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));

describe('the initial war map', () => {
  it('has 36 sectors around an empty center, within 3 hexes of it', () => {
    expect(map).toHaveLength(36);
    expect(new Set(map.map((sector) => hexKey(sector.coord))).size).toBe(36);
    expect(map.map(distanceFromCenter).every((d) => d >= 1 && d <= 3)).toBe(true);
  });

  it('gives every sector a unique id and name', () => {
    expect(new Set(map.map((sector) => sector.id)).size).toBe(36);
    expect(new Set(map.map((sector) => sector.name)).size).toBe(36);
  });

  it.each(FACTIONS)('gives %s 12 sectors in one connected territory', (faction) => {
    expect(territoryOf(faction)).toHaveLength(12);
    expect(isConnected(territoryOf(faction))).toBe(true);
  });

  it.each(FACTIONS)('lets %s attack both other factions from the start', (faction) => {
    const targets = new Set(attackableSectors(map, faction).map((sector) => sector.owner));

    expect(targets).toEqual(new Set(FACTIONS.filter((other) => other !== faction)));
  });
});
