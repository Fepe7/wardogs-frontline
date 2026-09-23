import { describe, expect, it } from 'vitest';
import type { FactionPlacements } from '../../shared/domain/faction';
import {
  openBattle,
  resolveBattle,
  scoreMatch,
  type BattleId,
  type OpenBattle,
  type ScorableMatch,
} from './battle';
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

let reportCounter = 0;
const match = (placements: FactionPlacements, hours = 1, reportId?: string): ScorableMatch => {
  reportCounter += 1;
  return {
    reportId: reportId ?? `report-${String(reportCounter)}`,
    placements,
    playedAt: at(hours),
  };
};

const scored = (battle: OpenBattle, ...matches: ScorableMatch[]): OpenBattle =>
  matches.reduce((current, played) => {
    const result = scoreMatch(current, played);
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }, battle);

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
      scoredReportIds: [],
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

  it('lasts as long as the pace of the war says', () => {
    const result = openBattle({
      id: 'battle-1' as BattleId,
      sector: steelValley,
      attacker: 'valkyra',
      startsAt: start,
      durationHours: 3,
    });

    expect(result.ok && result.value.endsAt).toEqual(at(3));
  });
});

describe('scoreMatch', () => {
  it('adds the points each side earned in a match played during the battle', () => {
    expect(scored(newBattle(), match(valkyraWins)).points).toEqual({ attacker: 3, defender: 2 });
  });

  it('also counts matches won by the third faction', () => {
    expect(scored(newBattle(), match(manticoreWinsValkyraSecond)).points).toEqual({
      attacker: 2,
      defender: 1,
    });
  });

  it('accumulates points across matches', () => {
    expect(scored(newBattle(), match(valkyraWins), match(lonestarWins, 2)).points).toEqual({
      attacker: 5,
      defender: 5,
    });
  });

  it('scores each report only once, so a retried event never counts twice', () => {
    const played = match(valkyraWins, 1, 'report-x');

    const battle = scored(newBattle(), played, played);

    expect(battle.points).toEqual({ attacker: 3, defender: 2 });
    expect(battle.scoredReportIds).toEqual(['report-x']);
  });

  it('does not modify the original battle', () => {
    const battle = newBattle();
    scoreMatch(battle, match(valkyraWins));

    expect(battle.points).toEqual({ attacker: 0, defender: 0 });
  });

  it('ignores matches played before the battle started or once it has ended', () => {
    expect(scoreMatch(newBattle(), match(valkyraWins, -1))).toEqual({
      ok: false,
      error: 'match-outside-battle',
    });
    expect(scoreMatch(newBattle(), match(valkyraWins, 48))).toEqual({
      ok: false,
      error: 'match-outside-battle',
    });
  });
});

describe('resolveBattle', () => {
  it('gives the sector to the attacker when it scores more points', () => {
    const result = resolveBattle(scored(newBattle(), match(valkyraWins)), at(48));

    expect(result.ok && result.value).toMatchObject({
      status: 'resolved',
      winner: 'valkyra',
      conquered: true,
      points: { attacker: 3, defender: 2 },
    });
  });

  it('keeps the sector with the defender when it scores more points', () => {
    const result = resolveBattle(scored(newBattle(), match(lonestarWins)), at(48));

    expect(result.ok && result.value).toMatchObject({ winner: 'lonestar', conquered: false });
  });

  it('keeps the sector with the defender on a tie', () => {
    const result = resolveBattle(
      scored(newBattle(), match(valkyraWins), match(lonestarWins)),
      at(48),
    );

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
