import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger, setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { composeUseCases } from './composition';
import { dispatchEvent } from './events/dispatch-event';

// Every function runs in the same region as Firestore (docs/adr/0002).
// maxInstances caps the cost of a traffic spike or abuse.
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

initializeApp();
const db = getFirestore();
const useCases = composeUseCases(db);

/**
 * Outbox dispatcher: delivers every integration event to the contexts that consume it.
 * `retry` redelivers on failure; dispatchEvent and the consumers are idempotent.
 */
export const onIntegrationEvent = onDocumentCreated(
  { document: 'events/{eventId}', retry: true },
  async (event) => {
    const { delivered } = await dispatchEvent(db, useCases, event.params.eventId);
    logger.info('Integration event dispatched', { eventId: event.params.eventId, delivered });
  },
);

/** Moves the war forward: resolves ended battles and closes ended vote rounds. */
export const advanceWarJob = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Europe/Madrid' },
  async () => {
    const summary = await useCases.advanceWar();
    logger.info('War advanced', summary);
  },
);
