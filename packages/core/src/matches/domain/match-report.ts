import type { Brand } from '../../shared/domain/brand';
import {
  createFactionPlacements,
  type FactionPlacements,
  type PlacementsError,
} from '../../shared/domain/faction';
import type { MatchApproved } from '../../shared/domain/integration-events';
import type { PlayerId } from '../../shared/domain/player-id';
import { err, ok, type Result } from '../../shared/domain/result';

export type MatchReportId = Brand<string, 'MatchReportId'>;

/**
 * Where a result comes from. Only manual reports exist for now; allied community
 * servers will add a `server` source that is approved automatically.
 */
export interface ManualSource {
  readonly kind: 'manual';
  readonly screenshotPath: string;
}

export type MatchResultSource = ManualSource;

interface ReportBase {
  readonly id: MatchReportId;
  readonly placements: FactionPlacements;
  readonly playedAt: Date;
  readonly reportedBy: PlayerId;
  readonly reportedAt: Date;
  readonly source: MatchResultSource;
}

export interface Moderation {
  readonly moderatorId: PlayerId;
  readonly decidedAt: Date;
}

export interface PendingReport extends ReportBase {
  readonly status: 'pending';
}

export interface ApprovedReport extends ReportBase {
  readonly status: 'approved';
  readonly moderation: Moderation;
}

export interface RejectedReport extends ReportBase {
  readonly status: 'rejected';
  readonly moderation: Moderation & { readonly reason: string };
}

export type MatchReport = PendingReport | ApprovedReport | RejectedReport;

export type SubmitError = PlacementsError | 'played-in-future' | 'missing-screenshot';

export const submitManualReport = (params: {
  id: MatchReportId;
  placements: FactionPlacements;
  playedAt: Date;
  reportedBy: PlayerId;
  reportedAt: Date;
  screenshotPath: string;
}): Result<PendingReport, SubmitError> => {
  const { screenshotPath, ...report } = params;

  const placements = createFactionPlacements(report.placements);
  if (!placements.ok) return placements;
  if (report.playedAt.getTime() > report.reportedAt.getTime()) return err('played-in-future');
  if (screenshotPath.length === 0) return err('missing-screenshot');

  return ok({ status: 'pending', ...report, source: { kind: 'manual', screenshotPath } });
};

/** Moderators cannot judge their own reports. */
const isSelfModeration = (report: PendingReport, moderation: Moderation): boolean =>
  report.reportedBy === moderation.moderatorId;

export const approveReport = (
  report: PendingReport,
  moderation: Moderation,
): Result<{ report: ApprovedReport; event: MatchApproved }, 'self-moderation'> => {
  if (isSelfModeration(report, moderation)) return err('self-moderation');

  return ok({
    report: { ...report, status: 'approved', moderation },
    event: {
      type: 'MatchApproved',
      reportId: report.id,
      placements: report.placements,
      playedAt: report.playedAt,
      occurredAt: moderation.decidedAt,
    },
  });
};

export const rejectReport = (
  report: PendingReport,
  moderation: Moderation & { reason: string },
): Result<RejectedReport, 'self-moderation' | 'missing-reason'> => {
  if (isSelfModeration(report, moderation)) return err('self-moderation');

  const reason = moderation.reason.trim();
  if (reason.length === 0) return err('missing-reason');

  return ok({ ...report, status: 'rejected', moderation: { ...moderation, reason } });
};
