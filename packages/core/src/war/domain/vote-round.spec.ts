import { describe, expect, it } from 'vitest';
import type { PlayerId } from '../../shared/domain/player-id';
import {
  castVote,
  openVoteRound,
  tallyVotes,
  withdrawVote,
  type VoteRound,
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

const newRound = (): VoteRound =>
  openVoteRound({ id: 'round-1' as VoteRoundId, faction: 'valkyra', opensAt });

const vote = (round: VoteRound, playerId: string, sectorId: SectorId, hours: number): VoteRound => {
  const result = castVote(round, map, {
    playerId: player(playerId),
    voterFaction: 'valkyra',
    sectorId,
    castAt: at(hours),
  });
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

describe('openVoteRound', () => {
  it('opens a 24 h round with no votes', () => {
    expect(newRound()).toEqual({
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
    const result = castVote(newRound(), map, {
      playerId: player('spy'),
      voterFaction: 'manticore',
      sectorId: steelValley,
      castAt: at(1),
    });

    expect(result).toEqual({ ok: false, error: 'wrong-faction' });
  });

  it('rejects sectors the faction cannot attack', () => {
    const result = castVote(newRound(), map, {
      playerId: player('ana'),
      voterFaction: 'valkyra',
      sectorId: 'north-dam' as SectorId,
      castAt: at(1),
    });

    expect(result).toEqual({ ok: false, error: 'not-adjacent' });
  });

  it('rejects votes before the round opens or once it has closed', () => {
    const cast = (hours: number) =>
      castVote(newRound(), map, {
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
  it('attacks the most voted sector', () => {
    let round = vote(newRound(), 'ana', steelValley, 1);
    round = vote(round, 'ben', steelValley, 2);
    round = vote(round, 'cai', lonestarHq, 3);

    expect(tallyVotes(round, at(24))).toEqual({
      ok: true,
      value: { kind: 'attack', sectorId: 'steel-valley' },
    });
  });

  it('on a tie, attacks the sector that reached its final count first', () => {
    let round = vote(newRound(), 'ana', lonestarHq, 1);
    round = vote(round, 'ben', steelValley, 2);
    round = vote(round, 'cai', steelValley, 3);
    round = vote(round, 'dan', lonestarHq, 4);

    // Both have 2 votes: steel-valley got its 2nd at hour 3, lonestar-hq at hour 4.
    expect(tallyVotes(round, at(24))).toEqual({
      ok: true,
      value: { kind: 'attack', sectorId: 'steel-valley' },
    });
  });

  it('does not attack when nobody voted', () => {
    expect(tallyVotes(newRound(), at(24))).toEqual({ ok: true, value: { kind: 'no-attack' } });
  });

  it('cannot be tallied before the round closes', () => {
    expect(tallyVotes(newRound(), at(23))).toEqual({ ok: false, error: 'round-not-closed' });
  });
});
