import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type {
  Clock,
  EventOutbox,
  IdGenerator,
  IntegrationEvent,
  TransactionRunner,
} from '@frontline/core';
import { toFirestoreData } from './firestore-data';

export const COLLECTIONS = {
  events: 'events',
  matchReports: 'matchReports',
  players: 'players',
  war: 'war',
  voteRounds: 'voteRounds',
  battles: 'battles',
  rateLimits: 'rateLimits',
  steamNonces: 'steamNonces',
} as const;

/**
 * Transactional outbox: events are written to `events/` by the same transaction as the
 * state change, and dispatched to the other contexts by a Firestore trigger.
 */
class FirestoreOutbox implements EventOutbox {
  constructor(
    private readonly db: Firestore,
    private readonly transaction: Transaction,
  ) {}

  add(event: IntegrationEvent): void {
    const ref = this.db.collection(COLLECTIONS.events).doc();
    this.transaction.set(ref, toFirestoreData({ ...event, processedBy: [] }) as object);
  }
}

/**
 * Runs a use case inside a Firestore transaction. Firestore requires every read to
 * happen before any write, and retries the whole callback on contention.
 */
export const firestoreTransaction = <Context>(
  db: Firestore,
  createContext: (transaction: Transaction, outbox: EventOutbox) => Context,
): TransactionRunner<Context> => ({
  run: (work) =>
    db.runTransaction((transaction) =>
      work(createContext(transaction, new FirestoreOutbox(db, transaction))),
    ),
});

export const systemClock: Clock = { now: () => new Date() };

/** Random ids with the same generator Firestore uses for auto ids. */
export const firestoreIds = (db: Firestore): IdGenerator => ({
  next: () => db.collection(COLLECTIONS.events).doc().id,
});
