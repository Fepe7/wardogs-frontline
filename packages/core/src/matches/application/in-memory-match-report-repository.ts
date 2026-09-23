import type { MatchReport, MatchReportId } from '../domain/match-report';
import type { MatchReportRepository } from './ports';

/** In-memory adapter for use case tests. */
export class InMemoryMatchReportRepository implements MatchReportRepository {
  private readonly reports = new Map<MatchReportId, MatchReport>();

  findById(id: MatchReportId): Promise<MatchReport | null> {
    return Promise.resolve(this.reports.get(id) ?? null);
  }

  save(report: MatchReport): Promise<void> {
    this.reports.set(report.id, report);
    return Promise.resolve();
  }

  all(): MatchReport[] {
    return [...this.reports.values()];
  }
}
