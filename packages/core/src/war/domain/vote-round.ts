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

export type VoteOutcome =
  { readonly kind: 'attack'; readonly sectorId: SectorId } | { readonly kind: 'no-attack' };

interface VoteRoundBase {
  readonly id: VoteRoundId;
  readonly faction: Faction;
  readonly opensAt: Date;
  readonly closesAt: Date;
  /** One current vote per player. */
  readonly votes: readonly Vote[];
}

/** A faction choosing, by majority, which enemy sector to attack next. */
export interface OpenVoteRound extends VoteRoundBase {
  readonly status: 'open';
}

export interface ClosedVoteRound extends VoteRoundBase {
  readonly status: 'closed';
  readonly outcome: VoteOutcome;
}

export type VoteRound = OpenVoteRound | ClosedVoteRound;

export type VoteError = 'wrong-faction' | 'round-closed' | AttackError;

const HOUR_MS = 60 * 60 * 1000;

export const openVoteRound = (params: {
  id: VoteRoundId;
  faction: Faction;
  opensAt: Date;
}): OpenVoteRound => ({
  status: 'open',
  ...params,
  closesAt: new Date(params.opensAt.getTime() + GAME_CONFIG.voteRoundDurationHours * HOUR_MS),
  votes: [],
});

/** Rounds run on the half-open interval [opensAt, closesAt). */
const isOpenAt = (round: OpenVoteRound, instant: Date): boolean =>
  instant.getTime() >= round.opensAt.getTime() && instant.getTime() < round.closesAt.getTime();

/** Records a vote. A player who votes again replaces their previous vote. */
export const castVote = (
  round: OpenVoteRound,
  map: readonly Sector[],
  underAttack: ReadonlySet<SectorId>,
  ballot: { playerId: PlayerId; voterFaction: Faction; sectorId: SectorId; castAt: Date },
): Result<OpenVoteRound, VoteError> => {
  if (ballot.voterFaction !== round.faction) return err('wrong-faction');
  if (!isOpenAt(round, ballot.castAt)) return err('round-closed');

  const target = canAttack(map, round.faction, ballot.sectorId, underAttack);
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

/** Drops the vote of a player who left the faction while the round was open. */
export const withdrawVote = (round: OpenVoteRound, playerId: PlayerId): OpenVoteRound => ({
  ...round,
  votes: round.votes.filter((vote) => vote.playerId !== playerId),
});

interface SectorTally {
  readonly sectorId: SectorId;
  readonly votes: number;
  /** When the sector reached its final count: the time of its latest current vote. */
  readonly reachedAt: number;
}

/** Sectors from most to least voted; ties go to the sector that reached its count first. */
const rankSectors = (votes: readonly Vote[]): SectorTally[] => {
  const tallies = new Map<SectorId, SectorTally>();
  for (const vote of votes) {
    const previous = tallies.get(vote.sectorId);
    tallies.set(vote.sectorId, {
      sectorId: vote.sectorId,
      votes: (previous?.votes ?? 0) + 1,
      reachedAt: Math.max(previous?.reachedAt ?? 0, vote.castAt.getTime()),
    });
  }
  return [...tallies.values()].sort((a, b) => b.votes - a.votes || a.reachedAt - b.reachedAt);
};

/**
 * Closes the round. The faction attacks the most voted sector that is still
 * attackable (the map may have changed during the vote); otherwise it does not attack.
 */
export const tallyVotes = (
  round: OpenVoteRound,
  context: { now: Date; map: readonly Sector[]; underAttack: ReadonlySet<SectorId> },
): Result<ClosedVoteRound, 'round-not-closed'> => {
  if (context.now.getTime() < round.closesAt.getTime()) return err('round-not-closed');

  const target = rankSectors(round.votes).find(
    (tally) => canAttack(context.map, round.faction, tally.sectorId, context.underAttack).ok,
  );
  const outcome: VoteOutcome = target
    ? { kind: 'attack', sectorId: target.sectorId }
    : { kind: 'no-attack' };

  return ok({ ...round, status: 'closed', outcome });
};
