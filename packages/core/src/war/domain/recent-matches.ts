import { GAME_CONFIG } from '../../config/game';
import type { FactionPlacements } from '../../shared/domain/faction';
import type { BattleId } from './battle';

/**
 * A match the war has counted, as the board shows it: final placements, when it was
 * played and the battles it scored in. No player data, so it can be read by anyone.
 */
export interface RecentMatch {
  readonly matchId: string;
  readonly placements: FactionPlacements;
  readonly playedAt: Date;
  readonly battleIds: readonly BattleId[];
}

/**
 * Adds a counted match to the front of the recent list, keeping only the latest few.
 * Idempotent: a match already remembered returns the same list unchanged.
 */
export const rememberMatch = (
  recent: readonly RecentMatch[],
  match: RecentMatch,
): readonly RecentMatch[] => {
  if (recent.some((known) => known.matchId === match.matchId)) return recent;
  return [match, ...recent].slice(0, GAME_CONFIG.recentMatchesKept);
};
