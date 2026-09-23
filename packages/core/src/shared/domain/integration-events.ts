import type { FactionPlacements } from './faction';

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
