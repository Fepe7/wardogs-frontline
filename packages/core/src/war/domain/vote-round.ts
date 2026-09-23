import { GAME_CONFIG } from '../../config/game';
import type { Brand } from '../../shared/domain/brand';
import type { Faction } from '../../shared/domain/faction';
import type { PlayerId } from '../../shared/domain/player-id';
import { err, ok, type Result } from '../../shared/domain/result';
import { canAttack, type AttackError, type Sector, type SectorId } from './war-map';

export type VoteRoundId = Brand<string, 'VoteRoundId'>;

export interface Vote {
  readonly playerId: PlayerId;
  readonly sectorId: SectorId;
  readonly castAt: Date;
}

/** A faction choosing, by majority, which enemy sector to attack next. */
export interface VoteRound {
  readonly id: VoteRoundId;
  readonly faction: Faction;
  readonly opensAt: Date;
  readonly closesAt: Date;
  /** One current vote per player. */
  readonly votes: readonly Vote[];
}

export type VoteError = 'wrong-faction' | 'round-closed' | AttackError;

export type VoteOutcome =
  { readonly kind: 'attack'; readonly sectorId: SectorId } | { readonly kind: 'no-attack' };

const HOUR_MS = 60 * 60 * 1000;

export const openVoteRound = (params: {
  id: VoteRoundId;
  faction: Faction;
  opensAt: Date;
}): VoteRound => ({
  ...params,
  closesAt: new Date(params.opensAt.getTime() + GAME_CONFIG.voteRoundDurationHours * HOUR_MS),
  votes: [],
});

/** Rounds run on the half-open interval [opensAt, closesAt). */
const isOpenAt = (round: VoteRound, instant: Date): boolean =>
  instant.getTime() >= round.opensAt.getTime() && instant.getTime() < round.closesAt.getTime();

/** Records a vote. A player who votes again replaces their previous vote. */
export const castVote = (
  round: VoteRound,
  map: readonly Sector[],
  ballot: { playerId: PlayerId; voterFaction: Faction; sectorId: SectorId; castAt: Date },
): Result<VoteRound, VoteError> => {
  if (ballot.voterFaction !== round.faction) return err('wrong-faction');
  if (!isOpenAt(round, ballot.castAt)) return err('round-closed');

  const target = canAttack(map, round.faction, ballot.sectorId);
  if (!target.ok) return target;

  const { playerId, sectorId, castAt } = ballot;
  return ok({
    ...round,
    votes: [
      ...round.votes.filter((vote) => vote.playerId !== playerId),
      { playerId, sectorId, castAt },
    ],
  });
};

interface SectorTally {
  readonly sectorId: SectorId;
  readonly votes: number;
  /** When the sector reached its final count: the time of its latest current vote. */
  readonly reachedAt: number;
}

const tallyBySector = (votes: readonly Vote[]): SectorTally[] => {
  const tallies = new Map<SectorId, SectorTally>();
  for (const vote of votes) {
    const previous = tallies.get(vote.sectorId);
    tallies.set(vote.sectorId, {
      sectorId: vote.sectorId,
      votes: (previous?.votes ?? 0) + 1,
      reachedAt: Math.max(previous?.reachedAt ?? 0, vote.castAt.getTime()),
    });
  }
  return [...tallies.values()];
};

/** Most votes wins; on a tie, the sector that reached its final count first. */
const ranksHigher = (a: SectorTally, b: SectorTally): boolean =>
  a.votes > b.votes || (a.votes === b.votes && a.reachedAt < b.reachedAt);

/** Once the round has closed, decides the faction's next attack. No votes means no attack. */
export const tallyVotes = (
  round: VoteRound,
  now: Date,
): Result<VoteOutcome, 'round-not-closed'> => {
  if (now.getTime() < round.closesAt.getTime()) return err('round-not-closed');

  const winner = tallyBySector(round.votes).reduce<SectorTally | undefined>(
    (best, tally) => (best === undefined || ranksHigher(tally, best) ? tally : best),
    undefined,
  );

  return ok(winner ? { kind: 'attack', sectorId: winner.sectorId } : { kind: 'no-attack' });
};

/** Drops the vote of a player who left the faction while the round was open. */
export const withdrawVote = (round: VoteRound, playerId: PlayerId): VoteRound => ({
  ...round,
  votes: round.votes.filter((vote) => vote.playerId !== playerId),
});
