import type { Faction, Sector, SectorId } from '@frontline/core';
import { attackArrow } from './attack-arrows';
import { hexCenter } from './hex-layout';

const sector = (id: string, q: number, r: number, owner: Faction): Sector => ({
  id: id as SectorId,
  name: id,
  coord: { q, r },
  owner,
});

/**
 *   valkyra-far (-1,0)   valkyra-front (0,0)   target (1,0) Lonestar   lonestar (2,0)
 *                        valkyra-side (0,1) also borders the target
 */
const map = [
  sector('valkyra-far', -1, 0, 'valkyra'),
  sector('valkyra-front', 0, 0, 'valkyra'),
  sector('valkyra-side', 0, 1, 'valkyra'),
  sector('target', 1, 0, 'lonestar'),
  sector('lonestar', 2, 0, 'lonestar'),
];
const target = 'target' as SectorId;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('the attack arrow', () => {
  it('comes from the attacker neighbour closest to the heart of its territory', () => {
    const arrow = attackArrow(map, { sectorId: target, attacker: 'valkyra' });

    expect(arrow?.fromSectorId).toBe('valkyra-front');
  });

  it('crosses the border into the sector under attack', () => {
    const arrow = attackArrow(map, { sectorId: target, attacker: 'valkyra' });
    const origin = hexCenter({ q: 0, r: 0 });
    const destination = hexCenter({ q: 1, r: 0 });

    expect(arrow).not.toBeNull();
    const { from, to } = arrow ?? { from: origin, to: origin };
    expect(distance(from, origin)).toBeLessThan(distance(from, destination));
    expect(distance(to, destination)).toBeLessThan(distance(to, origin));
  });

  it('is left out when the attacker no longer borders the sector', () => {
    const lost = map.map((s) =>
      s.owner === 'valkyra' ? { ...s, owner: 'manticore' as const } : s,
    );

    expect(attackArrow(lost, { sectorId: target, attacker: 'valkyra' })).toBeNull();
  });
});
