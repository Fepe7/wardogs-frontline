import { describe, expect, it } from 'vitest';
import type { PlayerId } from '../../shared/domain/player-id';
import {
  castVote,
  openVoteRound,
  tallyVotes,
  withdrawVote,
  type OpenVoteRound,
  type VoteRoundId,
} from './vote-round';
import type { Sector, SectorId } from './war-map';

const HOUR_MS = 60 * 60 * 1000;
const opensAt = new Date('2026-10-01T18:00:00Z');
const at = (hours: number) => new Date(opensAt.getTime() + hours * HOUR_MS);

const sector = (id: string, q: number, owner: Sector['owner']): Sector => ({
  id: id as SectorId,
  name: id,
  coord: { q, r: 0 },
  owner,
});

// lonestar-hq (-1) | valkyra-hq (0) | steel-valley (1, lonestar) | north-dam (2, manticore)
const map: readonly Sector[] = [
  sector('lonestar-hq', -1, 'lonestar'),
  sector('valkyra-hq', 0, 'valkyra'),
  sector('steel-valley', 1, 'lonestar'),
  sector('north-dam', 2, 'manticore'),
];

const steelValley = 'steel-valley' as SectorId;
const lonestarHq = 'lonestar-hq' as SectorId;
const player = (id: string) => id as PlayerId;
const nobodyUnderAttack: ReadonlySet<SectorId> = new Set();

const newRound = (): OpenVoteRound =>
  openVoteRound({ id: 'round-1' as VoteRoundId, faction: 'valkyra', opensAt });

const vote = (
  round: OpenVoteRound,
  playerId: string,
  sectorId: SectorId,
  hours: number,
): OpenVoteRound => {
  const result = castVote(round, map, nobodyUnderAttack, {
    playerId: player(playerId),
    voterFaction: 'valkyra',
    sectorId,
    castAt: at(hours),
  });
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

const tally = (round: OpenVoteRound, battleMap = map, underAttack = nobodyUnderAttack) =>
  tallyVotes(round, { now: at(24), map: battleMap, underAttack });

describe('openVoteRound', () => {
  it('opens a 24 h round with no votes', () => {
    expect(newRound()).toEqual({
      status: 'open',
      id: 'round-1',
      faction: 'valkyra',
      opensAt,
      closesAt: at(24),
      votes: [],
    });
  });
});

describe('castVote', () => {
  it('records the vote of a faction member for an attackable sector', () => {
    const round = vote(newRound(), 'ana', steelValley, 1);

    expect(round.votes).toEqual([{ playerId: 'ana', sectorId: 'steel-valley', castAt: at(1) }]);
  });

  it('lets a player change their vote until the round closes: only the last one counts', () => {
    const round = vote(vote(newRound(), 'ana', steelValley, 1), 'ana', lonestarHq, 2);

    expect(round.votes).toEqual([{ playerId: 'ana', sectorId: 'lonestar-hq', castAt: at(2) }]);
  });

  it('rejects players from another faction', () => {
    const result = castVote(newRound(), map, nobodyUnderAttack, {
      playerId: player('spy'),
      voterFaction: 'manticore',
      sectorId: steelValley,
      castAt: at(1),
    });

    expect(result).toEqual({ ok: false, error: 'wrong-faction' });
  });

  it('rejects sectors the faction cannot attack', () => {
    const result = castVote(newRound(), map, nobodyUnderAttack, {
      playerId: player('ana'),
      voterFaction: 'valkyra',
      sectorId: 'north-dam' as SectorId,
      castAt: at(1),
    });

    expect(result).toEqual({ ok: false, error: 'not-adjacent' });
  });

  it('rejects sectors already under attack', () => {
    const result = castVote(newRound(), map, new Set([steelValley]), {
      playerId: player('ana'),
      voterFaction: 'valkyra',
      sectorId: steelValley,
      castAt: at(1),
    });

    expect(result).toEqual({ ok: false, error: 'sector-under-attack' });
  });

  it('rejects votes before the round opens or once it has closed', () => {
    const cast = (hours: number) =>
      castVote(newRound(), map, nobodyUnderAttack, {
        playerId: player('ana'),
        voterFaction: 'valkyra',
        sectorId: steelValley,
        castAt: at(hours),
      });

    expect(cast(-1)).toEqual({ ok: false, error: 'round-closed' });
    expect(cast(24)).toEqual({ ok: false, error: 'round-closed' });
  });
});

describe('withdrawVote', () => {
  it("removes the vote of a player who left the faction, keeping everyone else's", () => {
    let round = vote(newRound(), 'ana', steelValley, 1);
    round = vote(round, 'ben', lonestarHq, 2);

    expect(withdrawVote(round, player('ana')).votes).toEqual([
      { playerId: 'ben', sectorId: 'lonestar-hq', castAt: at(2) },
    ]);
  });

  it('leaves the round unchanged when the player had not voted', () => {
    const round = vote(newRound(), 'ben', lonestarHq, 2);

    expect(withdrawVote(round, player('ana'))).toEqual(round);
  });
});

describe('tallyVotes', () => {
  it('closes the round and attacks the most voted sector', () => {
    let round = vote(newRound(), 'ana', steelValley, 1);
    round = vote(round, 'ben', steelValley, 2);
    round = vote(round, 'cai', lonestarHq, 3);

    const result = tally(round);

    expect(result.ok && result.value).toMatchObject({
      status: 'closed',
      outcome: { kind: 'attack', sectorId: 'steel-valley' },
    });
  });

  it('on a tie, attacks the sector that reached its final count first', () => {
    let round = vote(newRound(), 'ana', lonestarHq, 1);
    round = vote(round, 'ben', steelValley, 2);
    round = vote(round, 'cai', steelValley, 3);
    round = vote(round, 'dan', lonestarHq, 4);

    // Both have 2 votes: steel-valley got its 2nd at hour 3, lonestar-hq at hour 4.
    const result = tally(round);

    expect(result.ok && result.value.outcome).toEqual({ kind: 'attack', sectorId: 'steel-valley' });
  });

  it('attacks the next most voted sector when the winner is no longer attackable', () => {
    let round = vote(newRound(), 'ana', steelValley, 1);
    round = vote(round, 'ben', steelValley, 2);
    round = vote(round, 'cai', lonestarHq, 3);

    const result = tally(round, map, new Set([steelValley]));

    expect(result.ok && result.value.outcome).toEqual({ kind: 'attack', sectorId: 'lonestar-hq' });
  });

  it('does not attack when no voted sector is attackable any more', () => {
    const round = vote(newRound(), 'ana', steelValley, 1);
    const conqueredByValkyra = map.map((s) =>
      s.id === steelValley ? { ...s, owner: 'valkyra' as const } : s,
    );

    const result = tally(round, conqueredByValkyra);

    expect(result.ok && result.value.outcome).toEqual({ kind: 'no-attack' });
  });

  it('does not attack when nobody voted', () => {
    const result = tally(newRound());

    expect(result.ok && result.value.outcome).toEqual({ kind: 'no-attack' });
  });

  it('cannot be tallied before the round closes', () => {
    expect(tallyVotes(newRound(), { now: at(23), map, underAttack: nobodyUnderAttack })).toEqual({
      ok: false,
      error: 'round-not-closed',
    });
  });
});
