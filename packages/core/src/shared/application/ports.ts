import type { AllegianceChanged, MatchApproved } from '../domain/integration-events';

/** Source of the current time, injected so time-based rules are deterministic in tests. */
export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export type IntegrationEvent = MatchApproved | AllegianceChanged;

/**
 * Transactional outbox: events added here are persisted in the same transaction as
 * the state change, and dispatched to other contexts afterwards.
 */
export interface EventOutbox {
  add(event: IntegrationEvent): void;
}

/**
 * Runs a unit of work atomically (a Firestore transaction in production).
 * Use cases must validate everything before writing, so a failed Result never
 * leaves partial writes behind.
 */
export interface TransactionRunner<Context> {
  run<T>(work: (context: Context) => Promise<T>): Promise<T>;
}
