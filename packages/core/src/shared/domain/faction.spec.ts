import { describe, expect, it } from 'vitest';
import { createFactionPlacements, FACTIONS } from './faction';

describe('Faction', () => {
  it('has exactly the three Wardogs mercenary factions', () => {
    expect(FACTIONS).toEqual(['lonestar', 'valkyra', 'manticore']);
  });
});

describe('FactionPlacements', () => {
  it('accepts a final ranking where every faction appears once', () => {
    const result = createFactionPlacements({
      first: 'valkyra',
      second: 'lonestar',
      third: 'manticore',
    });

    expect(result).toEqual({
      ok: true,
      value: { first: 'valkyra', second: 'lonestar', third: 'manticore' },
    });
  });

  it('rejects a ranking where a faction appears twice', () => {
    const result = createFactionPlacements({
      first: 'valkyra',
      second: 'valkyra',
      third: 'manticore',
    });

    expect(result).toEqual({ ok: false, error: 'duplicate-faction' });
  });
});
