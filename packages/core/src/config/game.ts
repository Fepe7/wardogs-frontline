/**
 * Every tunable number of the war lives here, so balancing the game never
 * means hunting for magic numbers. See docs/DISEÑO.md for the rationale.
 */
export const GAME_CONFIG = {
  /** Points a faction earns per real match, by final placement. */
  pointsByPlacement: { first: 3, second: 2, third: 1 },
  /** Provisional durations, pending final decision (docs/DISEÑO.md §6). */
  voteRoundDurationHours: 24,
  battleDurationHours: 48,
} as const;
