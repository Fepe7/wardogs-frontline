import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logger, setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret, defineString } from 'firebase-functions/params';
import { createCallables } from './callables';
import { composeUseCases } from './composition';
import { dispatchEvent } from './events/dispatch-event';
import { signInWithSteam as signInWithSteamHandler } from './identity/handlers/sign-in-with-steam';
import { firestoreSteamNonces } from './identity/infrastructure/firestore-steam-nonces';
import { steamOpenIdVerifier } from './identity/infrastructure/steam-openid';
import { steamWebApiProfiles } from './identity/infrastructure/steam-profiles';
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

/** Steam Web API key (Secret Manager), used to read the player's public name. */
const steamApiKey = defineSecret('STEAM_API_KEY');
/** Origin of the web app; Steam must send the player back to its /auth/steam page. */
const webOrigin = defineString('WEB_ORIGIN');

/** Exchanges a Steam login for a Firebase custom token. The only callable without auth. */
export const signInWithSteam = onCall({ ...callableOptions, secrets: [steamApiKey] }, (request) =>
  // Built per call: secret and param values only exist at runtime, not at deploy time.
  signInWithSteamHandler({
    verifier: steamOpenIdVerifier({
      returnTo: `${webOrigin.value()}/auth/steam`,
      clock: systemClock,
    }),
    nonces: firestoreSteamNonces(db, systemClock),
    profiles: steamWebApiProfiles({ apiKey: steamApiKey.value() }),
    signInPlayer: useCases.signInPlayer,
    createToken: (uid) => getAuth().createCustomToken(uid),
  })(request),
);

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
