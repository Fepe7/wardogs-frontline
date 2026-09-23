import type { Faction, Sector, SectorId } from '@frontline/core';
import { frontLine } from './front-line';

const sector = (id: string, q: number, r: number, owner: Faction): Sector => ({
  id: id as SectorId,
  name: id,
  coord: { q, r },
  owner,
});

describe('the front line', () => {
  it('runs along every border between sectors of different factions', () => {
    const segments = frontLine([
      sector('a', 0, 0, 'lonestar'),
      sector('b', 1, 0, 'valkyra'),
      sector('c', 0, 1, 'valkyra'),
    ]);

    // a borders b and c; b and c belong to the same faction, so no front between them.
    expect(segments).toHaveLength(2);
  });

  it('draws each border once, not once per side', () => {
    const segments = frontLine([sector('a', 0, 0, 'lonestar'), sector('b', 1, 0, 'valkyra')]);

    expect(segments).toHaveLength(1);
  });

  it('is empty while a single faction holds everything', () => {
    const segments = frontLine([sector('a', 0, 0, 'manticore'), sector('b', 1, 0, 'manticore')]);

    expect(segments).toEqual([]);
  });

  it('places the border halfway between the two sector centers', () => {
    const [segment] = frontLine([sector('a', 0, 0, 'lonestar'), sector('b', 1, 0, 'valkyra')]);
    if (!segment) throw new Error('expected a front line');

    const midX = (segment.from.x + segment.to.x) / 2;
    const midY = (segment.from.y + segment.to.y) / 2;
    // Hex (1,0) is √3·size to the right of (0,0) with the default size of 10.
    expect(midX).toBeCloseTo((Math.sqrt(3) * 10) / 2);
    expect(midY).toBeCloseTo(0);
  });
});
