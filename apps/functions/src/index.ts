import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger, setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { createCallables } from './callables';
import { composeUseCases } from './composition';
import { dispatchEvent } from './events/dispatch-event';
import { firestoreRateLimiter } from './shared/infrastructure/firestore-rate-limiter';
import { systemClock } from './shared/infrastructure/firestore-transaction';

// Every function runs in the same region as Firestore (docs/adr/0002).
// maxInstances caps the cost of a traffic spike or abuse.
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

initializeApp();
const db = getFirestore();
const useCases = composeUseCases(db);
const callables = createCallables(db, useCases, firestoreRateLimiter(db, systemClock));

/** Callables used by the web app. App Check rejects calls that do not come from it. */
const callableOptions = { enforceAppCheck: true };
export const swearAllegiance = onCall(callableOptions, callables.swearAllegiance);
export const castVote = onCall(callableOptions, callables.castVote);
export const submitReport = onCall(callableOptions, callables.submitReport);
export const approveReport = onCall(callableOptions, callables.approveReport);
export const rejectReport = onCall(callableOptions, callables.rejectReport);

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
