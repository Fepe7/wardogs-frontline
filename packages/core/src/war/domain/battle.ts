import { GAME_CONFIG } from '../../config/game';
import type { Brand } from '../../shared/domain/brand';
import type { Faction, FactionPlacements } from '../../shared/domain/faction';
import { err, ok, type Result } from '../../shared/domain/result';
import { pointsForMatch } from './match-points';
import type { Sector, SectorId } from './war-map';

export type BattleId = Brand<string, 'BattleId'>;

interface BattleBase {
  readonly id: BattleId;
  readonly sectorId: SectorId;
  readonly attacker: Faction;
  readonly defender: Faction;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly points: Readonly<{ attacker: number; defender: number }>;
  /** Reports already counted, so a retried MatchApproved event never scores twice. */
  readonly scoredReportIds: readonly string[];
}

export interface OpenBattle extends BattleBase {
  readonly status: 'open';
}

export interface ResolvedBattle extends BattleBase {
  readonly status: 'resolved';
  readonly winner: Faction;
  /** True when the attacker won and takes the sector. */
  readonly conquered: boolean;
}

export type Battle = OpenBattle | ResolvedBattle;

/** An approved real match, as the war needs it (see the MatchApproved integration event). */
export interface ScorableMatch {
  readonly reportId: string;
  readonly placements: FactionPlacements;
  readonly playedAt: Date;
}

const HOUR_MS = 60 * 60 * 1000;

export const openBattle = (params: {
  id: BattleId;
  sector: Sector;
  attacker: Faction;
  startsAt: Date;
  durationHours?: number;
}): Result<OpenBattle, 'own-sector'> => {
  const {
    id,
    sector,
    attacker,
    startsAt,
    durationHours = GAME_CONFIG.pace.standard.battleHours,
  } = params;
  if (sector.owner === attacker) return err('own-sector');

  return ok({
    status: 'open',
    id,
    sectorId: sector.id,
    attacker,
    defender: sector.owner,
    startsAt,
    endsAt: new Date(startsAt.getTime() + durationHours * HOUR_MS),
    points: { attacker: 0, defender: 0 },
    scoredReportIds: [],
  });
};

/** Battles run on the half-open interval [startsAt, endsAt). */
const isDuringBattle = (battle: OpenBattle, instant: Date): boolean =>
  instant.getTime() >= battle.startsAt.getTime() && instant.getTime() < battle.endsAt.getTime();

/**
 * Adds the points attacker and defender earned in a real match played during the
 * battle. Scoring the same report again is a no-op (idempotent).
 */
export const scoreMatch = (
  battle: OpenBattle,
  match: ScorableMatch,
): Result<OpenBattle, 'match-outside-battle'> => {
  if (!isDuringBattle(battle, match.playedAt)) return err('match-outside-battle');
  if (battle.scoredReportIds.includes(match.reportId)) return ok(battle);

  const earned = pointsForMatch(match.placements);
  return ok({
    ...battle,
    points: {
      attacker: battle.points.attacker + earned[battle.attacker],
      defender: battle.points.defender + earned[battle.defender],
    },
    scoredReportIds: [...battle.scoredReportIds, match.reportId],
  });
};

/** Once the battle has ended, the side with more points wins. The defender wins ties. */
export const resolveBattle = (
  battle: OpenBattle,
  now: Date,
): Result<ResolvedBattle, 'battle-not-finished'> => {
  if (now.getTime() < battle.endsAt.getTime()) return err('battle-not-finished');

  const conquered = battle.points.attacker > battle.points.defender;
  return ok({
    ...battle,
    status: 'resolved',
    winner: conquered ? battle.attacker : battle.defender,
    conquered,
  });
};
