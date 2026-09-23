import { describe, expect, it } from 'vitest';
import type { FactionPlacements } from '../../shared/domain/faction';
import { openBattle, resolveBattle, scoreMatch, type BattleId, type OpenBattle } from './battle';
import type { Sector, SectorId } from './war-map';

const HOUR_MS = 60 * 60 * 1000;
const start = new Date('2026-10-01T18:00:00Z');
const at = (hours: number) => new Date(start.getTime() + hours * HOUR_MS);

const steelValley: Sector = {
  id: 'steel-valley' as SectorId,
  name: 'Steel Valley',
  coord: { q: 1, r: 0 },
  owner: 'lonestar',
};

const newBattle = (): OpenBattle => {
  const result = openBattle({
    id: 'battle-1' as BattleId,
    sector: steelValley,
    attacker: 'valkyra',
    startsAt: start,
  });
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

const valkyraWins: FactionPlacements = { first: 'valkyra', second: 'lonestar', third: 'manticore' };
const lonestarWins: FactionPlacements = {
  first: 'lonestar',
  second: 'valkyra',
  third: 'manticore',
};
const manticoreWinsValkyraSecond: FactionPlacements = {
  first: 'manticore',
  second: 'valkyra',
  third: 'lonestar',
};

describe('openBattle', () => {
  it('opens a 48 h battle between the attacker and the sector owner, starting at 0-0', () => {
    expect(newBattle()).toEqual({
      status: 'open',
      id: 'battle-1',
      sectorId: 'steel-valley',
      attacker: 'valkyra',
      defender: 'lonestar',
      startsAt: start,
      endsAt: at(48),
      points: { attacker: 0, defender: 0 },
    });
  });

  it('rejects a faction attacking its own sector', () => {
    const result = openBattle({
      id: 'battle-2' as BattleId,
      sector: steelValley,
      attacker: 'lonestar',
      startsAt: start,
    });

    expect(result).toEqual({ ok: false, error: 'own-sector' });
  });
});

describe('scoreMatch', () => {
  it('adds the points each side earned in a match played during the battle', () => {
    const result = scoreMatch(newBattle(), valkyraWins, at(1));

    expect(result.ok && result.value.points).toEqual({ attacker: 3, defender: 2 });
  });

  it('also counts matches won by the third faction', () => {
    const result = scoreMatch(newBattle(), manticoreWinsValkyraSecond, at(1));

    expect(result.ok && result.value.points).toEqual({ attacker: 2, defender: 1 });
  });

  it('accumulates points across matches', () => {
    const first = scoreMatch(newBattle(), valkyraWins, at(1));
    if (!first.ok) throw new Error(first.error);
    const second = scoreMatch(first.value, lonestarWins, at(2));

    expect(second.ok && second.value.points).toEqual({ attacker: 5, defender: 5 });
  });

  it('does not modify the original battle', () => {
    const battle = newBattle();
    scoreMatch(battle, valkyraWins, at(1));

    expect(battle.points).toEqual({ attacker: 0, defender: 0 });
  });

  it('ignores matches played before the battle started or once it has ended', () => {
    expect(scoreMatch(newBattle(), valkyraWins, at(-1))).toEqual({
      ok: false,
      error: 'match-outside-battle',
    });
    expect(scoreMatch(newBattle(), valkyraWins, at(48))).toEqual({
      ok: false,
      error: 'match-outside-battle',
    });
  });
});

describe('resolveBattle', () => {
  const scored = (...matches: FactionPlacements[]): OpenBattle =>
    matches.reduce((battle, placements) => {
      const result = scoreMatch(battle, placements, at(1));
      if (!result.ok) throw new Error(result.error);
      return result.value;
    }, newBattle());

  it('gives the sector to the attacker when it scores more points', () => {
    const result = resolveBattle(scored(valkyraWins), at(48));

    expect(result.ok && result.value).toMatchObject({
      status: 'resolved',
      winner: 'valkyra',
      conquered: true,
      points: { attacker: 3, defender: 2 },
    });
  });

  it('keeps the sector with the defender when it scores more points', () => {
    const result = resolveBattle(scored(lonestarWins), at(48));

    expect(result.ok && result.value).toMatchObject({ winner: 'lonestar', conquered: false });
  });

  it('keeps the sector with the defender on a tie', () => {
    const result = resolveBattle(scored(valkyraWins, lonestarWins), at(48));

    expect(result.ok && result.value).toMatchObject({ winner: 'lonestar', conquered: false });
  });

  it('keeps the sector with the defender when nobody played', () => {
    const result = resolveBattle(newBattle(), at(48));

    expect(result.ok && result.value).toMatchObject({ winner: 'lonestar', conquered: false });
  });

  it('cannot be resolved before it ends', () => {
    expect(resolveBattle(newBattle(), at(47))).toEqual({
      ok: false,
      error: 'battle-not-finished',
    });
  });
});
