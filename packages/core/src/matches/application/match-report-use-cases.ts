import type { Clock, IdGenerator, TransactionRunner } from '../../shared/application/ports';
import type { FactionPlacements } from '../../shared/domain/faction';
import type { PlayerId } from '../../shared/domain/player-id';
import { err, ok, type Result } from '../../shared/domain/result';
import {
  approveReport,
  rejectReport,
  submitManualReport,
  type ApprovedReport,
  type MatchReportId,
  type PendingReport,
  type RejectedReport,
  type SubmitError,
} from '../domain/match-report';
import type { MatchesTransactionContext, MatchReportRepository } from './ports';

interface MatchesDeps {
  readonly transaction: TransactionRunner<MatchesTransactionContext>;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

type LookupError = 'report-not-found' | 'report-not-pending';

const findPending = async (
  reports: MatchReportRepository,
  id: MatchReportId,
): Promise<Result<PendingReport, LookupError>> => {
  const report = await reports.findById(id);
  if (report === null) return err('report-not-found');
  if (report.status !== 'pending') return err('report-not-pending');
  return ok(report);
};

export const submitMatchReport =
  ({ transaction, clock, ids }: MatchesDeps) =>
  (command: {
    reportedBy: PlayerId;
    placements: FactionPlacements;
    playedAt: Date;
    screenshotPath: string;
  }): Promise<Result<PendingReport, SubmitError>> =>
    transaction.run(async ({ reports }) => {
      const report = submitManualReport({
        ...command,
        id: ids.next() as MatchReportId,
        reportedAt: clock.now(),
      });
      if (report.ok) await reports.save(report.value);
      return report;
    });

export const approveMatchReport =
  ({ transaction, clock }: Pick<MatchesDeps, 'transaction' | 'clock'>) =>
  (command: {
    reportId: MatchReportId;
    moderatorId: PlayerId;
  }): Promise<Result<ApprovedReport, LookupError | 'self-moderation'>> =>
    transaction.run(async ({ reports, outbox }) => {
      const pending = await findPending(reports, command.reportId);
      if (!pending.ok) return pending;

      const approval = approveReport(pending.value, {
        moderatorId: command.moderatorId,
        decidedAt: clock.now(),
      });
      if (!approval.ok) return approval;

      await reports.save(approval.value.report);
      outbox.add(approval.value.event);
      return ok(approval.value.report);
    });

export const rejectMatchReport =
  ({ transaction, clock }: Pick<MatchesDeps, 'transaction' | 'clock'>) =>
  (command: {
    reportId: MatchReportId;
    moderatorId: PlayerId;
    reason: string;
  }): Promise<Result<RejectedReport, LookupError | 'self-moderation' | 'missing-reason'>> =>
    transaction.run(async ({ reports }) => {
      const pending = await findPending(reports, command.reportId);
      if (!pending.ok) return pending;

      const rejection = rejectReport(pending.value, {
        moderatorId: command.moderatorId,
        decidedAt: clock.now(),
        reason: command.reason,
      });
      if (rejection.ok) await reports.save(rejection.value);
      return rejection;
    });
