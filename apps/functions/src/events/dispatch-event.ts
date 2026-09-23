import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { IntegrationEvent } from '@frontline/core';
import type { UseCases } from '../composition';
import { fromDocument } from '../shared/infrastructure/document-mapping';
import { COLLECTIONS } from '../shared/infrastructure/firestore-transaction';

type EventConsumers = Pick<UseCases, 'scoreApprovedMatch' | 'withdrawVoteOnAllegianceChange'>;

/** A named consumer, already bound to the event. The name is recorded in processedBy. */
type Delivery = readonly [consumer: string, deliver: () => Promise<void>];

/** Which consumers react to each integration event. */
const deliveriesFor = (event: IntegrationEvent, consumers: EventConsumers): Delivery[] => {
  switch (event.type) {
    case 'MatchApproved':
      return [['war.scoreApprovedMatch', () => consumers.scoreApprovedMatch(event)]];
    case 'AllegianceChanged':
      return [['war.withdrawVote', () => consumers.withdrawVoteOnAllegianceChange(event)]];
  }
};

interface StoredEvent {
  readonly event: IntegrationEvent;
  readonly processedBy: readonly string[];
}

const parseStoredEvent = (data: unknown): StoredEvent | null => {
  if (typeof data !== 'object' || data === null || !('type' in data)) return null;
  if (data.type !== 'MatchApproved' && data.type !== 'AllegianceChanged') return null;
  const processedBy =
    'processedBy' in data && Array.isArray(data.processedBy) ? data.processedBy : [];
  // Written only by the outbox in the same transaction as the state change.
  return { event: data as IntegrationEvent, processedBy: processedBy as string[] };
};

/**
 * Delivers an outbox event to its consumers. Triggers are at-least-once, so consumers
 * already listed in processedBy are skipped, and each one is recorded right after it
 * succeeds. The consumers themselves are idempotent too, in case the process dies
 * between delivering and recording.
 */
export const dispatchEvent = async (
  db: Firestore,
  consumers: EventConsumers,
  eventId: string,
): Promise<{ delivered: string[] }> => {
  const ref = db.collection(COLLECTIONS.events).doc(eventId);
  const stored = parseStoredEvent(fromDocument((await ref.get()).data()));
  if (stored === null) throw new Error(`Unknown integration event ${eventId}`);

  const delivered: string[] = [];
  for (const [consumer, deliver] of deliveriesFor(stored.event, consumers)) {
    if (stored.processedBy.includes(consumer)) continue;
    await deliver();
    await ref.update({ processedBy: FieldValue.arrayUnion(consumer) });
    delivered.push(consumer);
  }
  return { delivered };
};
