import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type {
  EventOutbox,
  MatchesTransactionContext,
  MatchReport,
  MatchReportId,
  MatchReportRepository,
} from '@frontline/core';
import { fromDocument, toDocument } from '../../shared/infrastructure/document-mapping';
import { COLLECTIONS } from '../../shared/infrastructure/firestore-transaction';

class FirestoreMatchReportRepository implements MatchReportRepository {
  constructor(
    private readonly db: Firestore,
    private readonly transaction: Transaction,
  ) {}

  async findById(id: MatchReportId): Promise<MatchReport | null> {
    const snapshot = await this.transaction.get(this.document(id));
    return snapshot.exists ? (fromDocument(snapshot.data()) as MatchReport) : null;
  }

  save(report: MatchReport): Promise<void> {
    this.transaction.set(this.document(report.id), toDocument(report));
    return Promise.resolve();
  }

  private document(id: MatchReportId) {
    return this.db.collection(COLLECTIONS.matchReports).doc(id);
  }
}

export const matchesContext =
  (db: Firestore) =>
  (transaction: Transaction, outbox: EventOutbox): MatchesTransactionContext => ({
    reports: new FirestoreMatchReportRepository(db, transaction),
    outbox,
  });
