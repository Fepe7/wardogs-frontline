/**
 * Every tunable number of the war lives here, so balancing the game never
 * means hunting for magic numbers. See docs/DISEÑO.md for the rationale.
 */
export const GAME_CONFIG = {
  /** Points a faction earns per real match, by final placement. */
  pointsByPlacement: { first: 3, second: 2, third: 1 },
  /** How long vote rounds and battles last (docs/DISEÑO.md §3 and §6). */
  pace: {
    /** Provisional season rhythm, pending final decision. */
    standard: { voteRoundHours: 24, battleHours: 48 },
    /** Demo in dev only: whole cycles within an afternoon. */
    demo: { voteRoundHours: 1, battleHours: 3 },
  },
  /** Minimum days between two faction changes. */
  allegianceChangeCooldownDays: 7,
} as const;

export interface WarPace {
  readonly voteRoundHours: number;
  readonly battleHours: number;
}
