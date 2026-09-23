import {
  attackableSectors,
  FACTIONS,
  initialWarMap,
  type Clock,
  type Faction,
  type FactionPlacements,
  type OpenVoteRound,
  type PlayerId,
  type Sector,
} from '@frontline/core';
import type { UseCases } from '../composition';

type SimulationUseCases = Pick<
  UseCases,
  'readWar' | 'startWar' | 'castVoteInRound' | 'recordVerifiedMatch'
>;

export interface SimulationDeps extends SimulationUseCases {
  readonly clock: Clock;
  /** Returns a number in [0, 1), like Math.random. Injected so tests are deterministic. */
  readonly random: () => number;
}

export interface SimulationSummary {
  readonly startedWar: boolean;
  readonly botVotes: number;
  readonly matches: number;
}

/** One simulated player per faction. Not a Steam account, so it can never sign in. */
const botOf = (faction: Faction): PlayerId => `bot:${faction}` as PlayerId;

const pick = <T>(items: readonly T[], random: () => number): T | undefined =>
  items[Math.floor(random() * items.length)];

const shuffledFactions = (random: () => number): Faction[] => {
  const remaining: Faction[] = [...FACTIONS];
  const shuffled: Faction[] = [];
  while (remaining.length > 0) {
    const [faction] = remaining.splice(Math.floor(random() * remaining.length), 1);
    if (faction) shuffled.push(faction);
  }
  return shuffled;
};

const randomPlacements = (random: () => number): FactionPlacements => {
  const [first = 'lonestar', second = 'valkyra', third = 'manticore'] = shuffledFactions(random);
  return { first, second, third };
};

const hasBotVote = (round: OpenVoteRound): boolean =>
  round.votes.some((vote) => vote.playerId === botOf(round.faction));

/**
 * Dev-only demo (docs/DISEÑO.md §5): keeps the war alive without real players or real
 * results. Each run starts the war if needed, lets each faction's bot vote once per
 * round for a random attackable sector, and records one match with random placements
 * through the same path an official results API would use (recordVerifiedMatch).
 */
export const simulateWar = (deps: SimulationDeps) => async (): Promise<SimulationSummary> => {
  let startedWar = false;
  let war = await deps.readWar();
  if (war.sectors === null) {
    await deps.startWar({ sectors: initialWarMap() });
    startedWar = true;
    war = await deps.readWar();
  }

  const sectors: readonly Sector[] = war.sectors ?? [];
  const underAttack = new Set(war.openBattles.map((battle) => battle.sectorId));
  let botVotes = 0;
  for (const round of war.openRounds.filter((r) => !hasBotVote(r))) {
    const target = pick(attackableSectors(sectors, round.faction, underAttack), deps.random);
    if (!target) continue;
    const vote = await deps.castVoteInRound({
      playerId: botOf(round.faction),
      voterFaction: round.faction,
      sectorId: target.id,
    });
    if (vote.ok) botVotes += 1;
  }

  const match = await deps.recordVerifiedMatch({
    placements: randomPlacements(deps.random),
    playedAt: deps.clock.now(),
  });

  return { startedWar, botVotes, matches: match.ok ? 1 : 0 };
};
