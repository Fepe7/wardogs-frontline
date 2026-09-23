import { beforeEach, describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../../config/game';
import type { Clock } from '../../shared/application/ports';
import { inMemoryTransaction, sequentialIds } from '../../shared/application/testing';
import type { Faction, FactionPlacements } from '../../shared/domain/faction';
import type { PlayerId } from '../../shared/domain/player-id';
import type { Sector, SectorId } from '../domain/war-map';
import {
  InMemoryBattleRepository,
  InMemoryRecentMatchesRepository,
  InMemoryVoteRoundRepository,
  InMemoryWarMapRepository,
} from './in-memory-war-repositories';
import {
  advanceWar,
  castVoteInRound,
  scoreApprovedMatch,
  startWar,
  withdrawVoteOnAllegianceChange,
} from './war-use-cases';

const HOUR_MS = 60 * 60 * 1000;
const start = new Date('2026-10-01T18:00:00Z');
const at = (hours: number) => new Date(start.getTime() + hours * HOUR_MS);

const sector = (id: string, q: number, r: number, owner: Faction): Sector => ({
  id: id as SectorId,
  name: id,
  coord: { q, r },
  owner,
});

/**
 *   lonestar-hq (0,0) - lonestar-farm (1,0) - valkyra-farm (2,0) - valkyra-hq (3,0)
 *                            manticore-farm (1,1)
 *                  manticore-hq (0,2)
 * valkyra can attack lonestar-farm and manticore-farm; manticore can attack
 * lonestar-farm and valkyra-farm.
 */
const initialMap: readonly Sector[] = [
  sector('lonestar-hq', 0, 0, 'lonestar'),
  sector('lonestar-farm', 1, 0, 'lonestar'),
  sector('valkyra-farm', 2, 0, 'valkyra'),
  sector('valkyra-hq', 3, 0, 'valkyra'),
  sector('manticore-farm', 1, 1, 'manticore'),
  sector('manticore-hq', 0, 2, 'manticore'),
];

const lonestarFarm = 'lonestar-farm' as SectorId;
const manticoreFarm = 'manticore-farm' as SectorId;
const player = (id: string) => id as PlayerId;

let map: InMemoryWarMapRepository;
let rounds: InMemoryVoteRoundRepository;
let battles: InMemoryBattleRepository;
let recentMatches: InMemoryRecentMatchesRepository;
let now: Date;
let deps: Parameters<typeof advanceWar>[0];

beforeEach(async () => {
  map = new InMemoryWarMapRepository();
  rounds = new InMemoryVoteRoundRepository();
  battles = new InMemoryBattleRepository();
  recentMatches = new InMemoryRecentMatchesRepository();
  now = start;
  const clock: Clock = { now: () => now };
  deps = {
    transaction: inMemoryTransaction({ map, rounds, battles, recentMatches }),
    clock,
    ids: sequentialIds('war'),
  };
  const started = await startWar(deps)({ sectors: initialMap });
  if (!started.ok) throw new Error(started.error);
});

const vote = async (playerId: string, faction: Faction, sectorId: SectorId, hours: number) => {
  now = at(hours);
  const result = await castVoteInRound(deps)({
    playerId: player(playerId),
    voterFaction: faction,
    sectorId,
  });
  if (!result.ok) throw new Error(result.error);
};

const advanceTo = (hours: number) => {
  now = at(hours);
  return advanceWar(deps)();
};

const openRoundOf = async (faction: Faction) =>
  (await rounds.findOpen()).find((round) => round.faction === faction);

const ownerOf = (sectorId: SectorId) => map.current?.find((s) => s.id === sectorId)?.owner;

const approved = (reportId: string, placements: FactionPlacements, hours: number) => ({
  type: 'MatchApproved' as const,
  reportId,
  placements,
  playedAt: at(hours),
  occurredAt: at(hours + 1),
});

describe('startWar', () => {
  it('stores the map and opens a vote round for every faction', async () => {
    expect(map.current).toEqual(initialMap);
    expect((await rounds.findOpen()).map((round) => round.faction).sort()).toEqual([
      'lonestar',
      'manticore',
      'valkyra',
    ]);
  });

  it('cannot start a war that has already started', async () => {
    expect(await startWar(deps)({ sectors: initialMap })).toEqual({
      ok: false,
      error: 'war-already-started',
    });
  });

  it('refuses an empty map', async () => {
    map.current = null;

    expect(await startWar(deps)({ sectors: [] })).toEqual({ ok: false, error: 'empty-map' });
  });
});

describe('castVoteInRound', () => {
  it("records the vote in the voter's faction round", async () => {
    await vote('ana', 'valkyra', lonestarFarm, 1);

    expect((await openRoundOf('valkyra'))?.votes).toEqual([
      { playerId: 'ana', sectorId: 'lonestar-farm', castAt: at(1) },
    ]);
  });

  it('propagates domain errors', async () => {
    const result = await castVoteInRound(deps)({
      playerId: player('ana'),
      voterFaction: 'valkyra',
      sectorId: 'lonestar-hq' as SectorId,
    });

    expect(result).toEqual({ ok: false, error: 'not-adjacent' });
  });

  it('rejects sectors already under attack', async () => {
    await vote('ana', 'valkyra', lonestarFarm, 1);
    await advanceTo(24);

    const result = await castVoteInRound(deps)({
      playerId: player('max'),
      voterFaction: 'manticore',
      sectorId: lonestarFarm,
    });

    expect(result).toEqual({ ok: false, error: 'sector-under-attack' });
  });

  it('fails when the faction has no open round (it is attacking)', async () => {
    await vote('ana', 'valkyra', lonestarFarm, 1);
    await advanceTo(24);

    const result = await castVoteInRound(deps)({
      playerId: player('ana'),
      voterFaction: 'valkyra',
      sectorId: manticoreFarm,
    });

    expect(result).toEqual({ ok: false, error: 'no-open-round' });
  });

  it('fails before the war has started', async () => {
    map.current = null;

    const result = await castVoteInRound(deps)({
      playerId: player('ana'),
      voterFaction: 'valkyra',
      sectorId: lonestarFarm,
    });

    expect(result).toEqual({ ok: false, error: 'war-not-started' });
  });
});

describe('withdrawVoteOnAllegianceChange', () => {
  const change = (from: Faction, to: Faction) => ({
    type: 'AllegianceChanged' as const,
    playerId: player('ana'),
    from,
    to,
    occurredAt: at(2),
  });

  it('drops the vote the player cast in the faction they left', async () => {
    await vote('ana', 'valkyra', lonestarFarm, 1);
    await vote('ben', 'valkyra', manticoreFarm, 1);

    await withdrawVoteOnAllegianceChange(deps)(change('valkyra', 'lonestar'));

    expect((await openRoundOf('valkyra'))?.votes.map((v) => v.playerId)).toEqual(['ben']);
  });

  it('does nothing when the faction has no open round', async () => {
    await vote('ana', 'valkyra', lonestarFarm, 1);
    await advanceTo(24);
    const before = rounds.all();

    await withdrawVoteOnAllegianceChange(deps)(change('valkyra', 'lonestar'));

    expect(rounds.all()).toEqual(before);
  });
});

describe('scoreApprovedMatch', () => {
  beforeEach(async () => {
    await vote('ana', 'valkyra', lonestarFarm, 1);
    await advanceTo(24); // valkyra attacks lonestar-farm during [24h, 72h)
  });

  const valkyraWins: FactionPlacements = {
    first: 'valkyra',
    second: 'manticore',
    third: 'lonestar',
  };

  it('scores the approved match in every open battle it was played in', async () => {
    await scoreApprovedMatch(deps)(approved('report-1', valkyraWins, 30));

    expect((await battles.findOpen())[0]?.points).toEqual({ attacker: 3, defender: 1 });
  });

  it('never scores the same report twice (the event can be delivered again)', async () => {
    await scoreApprovedMatch(deps)(approved('report-1', valkyraWins, 30));
    await scoreApprovedMatch(deps)(approved('report-1', valkyraWins, 30));

    expect((await battles.findOpen())[0]?.points).toEqual({ attacker: 3, defender: 1 });
  });

  it('ignores matches played outside every open battle', async () => {
    await scoreApprovedMatch(deps)(approved('report-1', valkyraWins, 10));

    expect((await battles.findOpen())[0]?.points).toEqual({ attacker: 0, defender: 0 });
  });

  it('remembers the match and the battles it scored in, so the board can show it', async () => {
    await scoreApprovedMatch(deps)(approved('report-1', valkyraWins, 30));

    const [battle] = await battles.findOpen();
    expect(recentMatches.current).toEqual([
      { matchId: 'report-1', placements: valkyraWins, playedAt: at(30), battleIds: [battle?.id] },
    ]);
  });

  it('does not list a match that counted in no battle', async () => {
    await scoreApprovedMatch(deps)(approved('report-1', valkyraWins, 10));

    expect(recentMatches.current).toEqual([]);
  });

  it('lists a match once when the event is delivered again', async () => {
    await scoreApprovedMatch(deps)(approved('report-1', valkyraWins, 30));
    await scoreApprovedMatch(deps)(approved('report-1', valkyraWins, 30));

    expect(recentMatches.current).toHaveLength(1);
  });
});

describe('advanceWar', () => {
  it('does nothing when nothing is due', async () => {
    expect(await advanceTo(23)).toEqual({ resolvedBattles: 0, closedRounds: 0 });
  });

  it('does nothing before the war has started', async () => {
    map.current = null;

    expect(await advanceTo(100)).toEqual({ resolvedBattles: 0, closedRounds: 0 });
  });

  it('opens a battle when the round closes, starting at the scheduled closing time', async () => {
    await vote('ana', 'valkyra', lonestarFarm, 1);

    await advanceTo(25); // the job runs an hour late

    expect(await battles.findOpen()).toMatchObject([
      {
        attacker: 'valkyra',
        defender: 'lonestar',
        sectorId: 'lonestar-farm',
        startsAt: at(24),
        endsAt: at(72),
      },
    ]);
    expect(rounds.all().find((round) => round.faction === 'valkyra')).toMatchObject({
      status: 'closed',
      outcome: { kind: 'attack', sectorId: 'lonestar-farm' },
    });
  });

  it('opens a new round right away for a faction that does not attack', async () => {
    await advanceTo(24);

    expect(await openRoundOf('lonestar')).toMatchObject({ opensAt: at(24), closesAt: at(48) });
    expect(await battles.findOpen()).toEqual([]);
  });

  it('gives a contested sector to the first faction processed; the other takes its next choice', async () => {
    await vote('ana', 'valkyra', lonestarFarm, 1);
    await vote('max', 'manticore', lonestarFarm, 1);
    await vote('mia', 'manticore', 'valkyra-farm' as SectorId, 2);

    await advanceTo(24);

    const attacked = (await battles.findOpen()).map((b) => `${b.attacker}->${b.sectorId}`);
    expect(attacked.sort()).toEqual(['manticore->valkyra-farm', 'valkyra->lonestar-farm']);
  });

  it('resolves a won battle: the sector changes hands and the attacker votes again', async () => {
    await vote('ana', 'valkyra', lonestarFarm, 1);
    await advanceTo(24);
    await scoreApprovedMatch(deps)(
      approved('report-1', { first: 'valkyra', second: 'manticore', third: 'lonestar' }, 30),
    );

    const summary = await advanceTo(72);

    expect(summary.resolvedBattles).toBe(1);
    expect(ownerOf(lonestarFarm)).toBe('valkyra');
    expect(battles.all()).toMatchObject([{ status: 'resolved', winner: 'valkyra' }]);
    expect(await openRoundOf('valkyra')).toMatchObject({ opensAt: at(72), closesAt: at(96) });
  });

  it('keeps a running battle open and its sector blocked for rounds closing later', async () => {
    await vote('ana', 'valkyra', lonestarFarm, 1);
    await advanceTo(24); // valkyra attacks lonestar-farm until 72h; others vote again 24h-48h
    now = at(30);
    const blocked = await castVoteInRound(deps)({
      playerId: player('max'),
      voterFaction: 'manticore',
      sectorId: lonestarFarm,
    });
    await vote('mia', 'manticore', 'valkyra-farm' as SectorId, 31);

    await advanceTo(48);

    expect(blocked).toEqual({ ok: false, error: 'sector-under-attack' });

    const attacked = (await battles.findOpen()).map((b) => `${b.attacker}->${b.sectorId}`);
    expect(attacked.sort()).toEqual(['manticore->valkyra-farm', 'valkyra->lonestar-farm']);
  });

  it('catches up when the job runs very late: the new round is closed in the same run', async () => {
    await vote('ana', 'valkyra', lonestarFarm, 1);
    await advanceTo(24);

    await advanceTo(100); // battle ended at 72h; valkyra's next round (72h-96h) is also over

    expect(
      rounds.all().filter((r) => r.faction === 'valkyra' && r.status === 'closed'),
    ).toHaveLength(2);
    expect(await openRoundOf('valkyra')).toMatchObject({ opensAt: at(96), closesAt: at(120) });
  });

  it('keeps the sector with the defender when the attacker does not win', async () => {
    await vote('ana', 'valkyra', lonestarFarm, 1);
    await advanceTo(24);

    await advanceTo(72);

    expect(ownerOf(lonestarFarm)).toBe('lonestar');
    expect(battles.all()).toMatchObject([{ status: 'resolved', winner: 'lonestar' }]);
  });
});

describe('the pace of the war', () => {
  it('can run faster, as in the demo: 1 h rounds and 3 h battles', async () => {
    const demoRounds = new InMemoryVoteRoundRepository();
    const demoBattles = new InMemoryBattleRepository();
    const demo = {
      ...deps,
      transaction: inMemoryTransaction({
        map: new InMemoryWarMapRepository(),
        rounds: demoRounds,
        battles: demoBattles,
        recentMatches: new InMemoryRecentMatchesRepository(),
      }),
      pace: GAME_CONFIG.pace.demo,
    };
    now = start;
    await startWar(demo)({ sectors: initialMap });
    now = at(0.5);
    await castVoteInRound(demo)({
      playerId: player('ana'),
      voterFaction: 'valkyra',
      sectorId: lonestarFarm,
    });

    now = at(1);
    await advanceWar(demo)();

    expect(await demoBattles.findOpen()).toMatchObject([{ startsAt: at(1), endsAt: at(4) }]);
    expect((await demoRounds.findOpen()).find((r) => r.faction === 'lonestar')).toMatchObject({
      opensAt: at(1),
      closesAt: at(2),
    });
  });
});
