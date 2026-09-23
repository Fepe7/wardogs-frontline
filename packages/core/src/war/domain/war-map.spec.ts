import { describe, expect, it } from 'vitest';
import { attackableSectors, canAttack, type Sector, type SectorId } from './war-map';

const sector = (id: string, q: number, r: number, owner: Sector['owner']): Sector => ({
  id: id as SectorId,
  name: id,
  coord: { q, r },
  owner,
});

// valkyra-hq (0,0) - steel-valley (1,0) - north-dam (2,0)
const map: readonly Sector[] = [
  sector('valkyra-hq', 0, 0, 'valkyra'),
  sector('steel-valley', 1, 0, 'lonestar'),
  sector('north-dam', 2, 0, 'manticore'),
];

describe('attackableSectors', () => {
  it('lists enemy sectors that border the faction territory', () => {
    expect(attackableSectors(map, 'valkyra').map((s) => s.id)).toEqual(['steel-valley']);
    expect(attackableSectors(map, 'lonestar').map((s) => s.id)).toEqual([
      'valkyra-hq',
      'north-dam',
    ]);
  });

  it('excludes sectors already under attack', () => {
    const underAttack = new Set(['valkyra-hq' as SectorId]);

    expect(attackableSectors(map, 'lonestar', underAttack).map((s) => s.id)).toEqual(['north-dam']);
  });

  it('is empty for a faction without territory', () => {
    const lonestarOnly = map.map((s) => ({ ...s, owner: 'lonestar' as const }));
    expect(attackableSectors(lonestarOnly, 'valkyra')).toEqual([]);
  });
});

describe('canAttack', () => {
  it('allows attacking a bordering enemy sector', () => {
    expect(canAttack(map, 'valkyra', 'steel-valley' as SectorId)).toEqual({
      ok: true,
      value: map[1],
    });
  });

  it('rejects a sector that does not border the faction territory', () => {
    expect(canAttack(map, 'valkyra', 'north-dam' as SectorId)).toEqual({
      ok: false,
      error: 'not-adjacent',
    });
  });

  it('rejects attacking an own sector', () => {
    expect(canAttack(map, 'valkyra', 'valkyra-hq' as SectorId)).toEqual({
      ok: false,
      error: 'own-sector',
    });
  });

  it('rejects a sector that is already under attack', () => {
    const underAttack = new Set(['steel-valley' as SectorId]);

    expect(canAttack(map, 'valkyra', 'steel-valley' as SectorId, underAttack)).toEqual({
      ok: false,
      error: 'sector-under-attack',
    });
  });

  it('rejects an unknown sector', () => {
    expect(canAttack(map, 'valkyra', 'atlantis' as SectorId)).toEqual({
      ok: false,
      error: 'sector-not-found',
    });
  });
});
