import { err, ok, type Result } from './result';

/** The three mercenary factions of Wardogs. Shared by the war and matches contexts. */
export const FACTIONS = ['lonestar', 'valkyra', 'manticore'] as const;

export type Faction = (typeof FACTIONS)[number];

export type Placement = 'first' | 'second' | 'third';

/** Final ranking of the three factions in one real match. */
export type FactionPlacements = Readonly<Record<Placement, Faction>>;

export type PlacementsError = 'duplicate-faction';

export const createFactionPlacements = (
  placements: FactionPlacements,
): Result<FactionPlacements, PlacementsError> => {
  const distinctFactions = new Set([placements.first, placements.second, placements.third]);

  return distinctFactions.size === FACTIONS.length ? ok(placements) : err('duplicate-faction');
};
