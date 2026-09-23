import type { Faction, FactionPlacements } from './faction';
import type { PlayerId } from './player-id';

/**
 * Events that cross bounded contexts. They live in the shared kernel so the
 * consuming context never imports the internals of the emitting one.
 */

/** Emitted by `matches` when a moderator approves a report; `war` scores open battles with it. */
export interface MatchApproved {
  readonly type: 'MatchApproved';
  readonly reportId: string;
  readonly placements: FactionPlacements;
  readonly playedAt: Date;
  readonly occurredAt: Date;
}

/** Emitted by `identity` when a player changes faction; `war` withdraws their open vote. */
export interface AllegianceChanged {
  readonly type: 'AllegianceChanged';
  readonly playerId: PlayerId;
  readonly from: Faction;
  readonly to: Faction;
  readonly occurredAt: Date;
}
