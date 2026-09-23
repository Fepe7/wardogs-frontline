import type { EventOutbox } from '../../shared/application/ports';
import type { MatchReport, MatchReportId } from '../domain/match-report';

export interface MatchReportRepository {
  findById(id: MatchReportId): Promise<MatchReport | null>;
  save(report: MatchReport): Promise<void>;
}

/** What a matches use case can touch inside one transaction. */
export interface MatchesTransactionContext {
  readonly reports: MatchReportRepository;
  readonly outbox: EventOutbox;
}
