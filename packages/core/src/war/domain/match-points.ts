import { GAME_CONFIG } from '../../config/game';
import type { Faction, FactionPlacements } from '../../shared/domain/faction';

/** Points every faction earns from one real match, according to its final placement. */
export const pointsForMatch = (placements: FactionPlacements): Record<Faction, number> => {
  const { first, second, third } = GAME_CONFIG.pointsByPlacement;
  const pointsOf = (faction: Faction): number => {
    if (faction === placements.first) return first;
    if (faction === placements.second) return second;
    return third;
  };

  return {
    lonestar: pointsOf('lonestar'),
    valkyra: pointsOf('valkyra'),
    manticore: pointsOf('manticore'),
  };
};
