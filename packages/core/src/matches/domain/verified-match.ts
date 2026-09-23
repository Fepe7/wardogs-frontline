import {
  createFactionPlacements,
  type FactionPlacements,
  type PlacementsError,
} from '../../shared/domain/faction';
import type { MatchApproved } from '../../shared/domain/integration-events';
import { err, ok, type Result } from '../../shared/domain/result';
import type { MatchReportId } from './match-report';

/**
 * A result that comes from a trusted automatic source is approved right away, without
 * moderation. Today that source is the dev simulator; an official results API from
 * Bulkhead would plug in here (docs/DISEÑO.md §5).
 */
export const verifyMatch = (params: {
  id: MatchReportId;
  placements: FactionPlacements;
  playedAt: Date;
  recordedAt: Date;
}): Result<MatchApproved, PlacementsError | 'played-in-future'> => {
  const placements = createFactionPlacements(params.placements);
  if (!placements.ok) return placements;
  if (params.playedAt.getTime() > params.recordedAt.getTime()) return err('played-in-future');

  return ok({
    type: 'MatchApproved',
    reportId: params.id,
    placements: placements.value,
    playedAt: params.playedAt,
    occurredAt: params.recordedAt,
  });
};
