import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logger, setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineBoolean, defineSecret, defineString } from 'firebase-functions/params';
import { GAME_CONFIG } from '@frontline/core';
import { createCallables } from './callables';
import { composeUseCases, type UseCases } from './composition';
import { dispatchEvent } from './events/dispatch-event';
import { signInWithSteam as signInWithSteamHandler } from './identity/handlers/sign-in-with-steam';
import { firestoreSteamNonces } from './identity/infrastructure/firestore-steam-nonces';
import { steamOpenIdVerifier } from './identity/infrastructure/steam-openid';
import { steamWebApiProfiles } from './identity/infrastructure/steam-profiles';
import { firestoreRateLimiter } from './shared/infrastructure/firestore-rate-limiter';
import { systemClock } from './shared/infrastructure/firestore-transaction';
import { simulateWar } from './simulation/simulate-war';

// Every function runs in the same region as Firestore (docs/adr/0002).
// maxInstances caps the cost of a traffic spike or abuse.
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

initializeApp();
const db = getFirestore();

/** Dev only: faster war pace, plus simulated votes and matches (docs/DISEÑO.md §5). */
const demoMode = defineBoolean('DEMO_MODE', { default: false });

interface Services {
  readonly useCases: UseCases;
  readonly callables: ReturnType<typeof createCallables>;
}
let services: Services | undefined;

/**
 * Wired on first use, not at module load: param values only exist at runtime, and the
 * deploy loads this module without them.
 */
const app = (): Services => {
  if (services) return services;
  const pace = demoMode.value() ? GAME_CONFIG.pace.demo : GAME_CONFIG.pace.standard;
  const useCases = composeUseCases(db, systemClock, pace);
  services = {
    useCases,
    callables: createCallables(db, useCases, firestoreRateLimiter(db, systemClock)),
  };
  return services;
};

/** Callables used by the web app. App Check rejects calls that do not come from it. */
const callableOptions = { enforceAppCheck: true };
export const swearAllegiance = onCall(callableOptions, (request) =>
  app().callables.swearAllegiance(request),
);
export const castVote = onCall(callableOptions, (request) => app().callables.castVote(request));
export const submitReport = onCall(callableOptions, (request) =>
  app().callables.submitReport(request),
);
export const approveReport = onCall(callableOptions, (request) =>
  app().callables.approveReport(request),
);
export const rejectReport = onCall(callableOptions, (request) =>
  app().callables.rejectReport(request),
);

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
    signInPlayer: app().useCases.signInPlayer,
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
    const { delivered } = await dispatchEvent(db, app().useCases, event.params.eventId);
    logger.info('Integration event dispatched', { eventId: event.params.eventId, delivered });
  },
);

/** Moves the war forward: resolves ended battles and closes ended vote rounds. */
export const advanceWarJob = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Europe/Madrid' },
  async () => {
    const summary = await app().useCases.advanceWar();
    logger.info('War advanced', summary);
  },
);

/** Dev-only demo: keeps the war alive with bot votes and simulated matches. */
export const simulateWarJob = onSchedule(
  { schedule: 'every 10 minutes', timeZone: 'Europe/Madrid' },
  async () => {
    if (!demoMode.value()) return;
    const { useCases } = app();
    const summary = await simulateWar({ ...useCases, clock: systemClock, random: Math.random })();
    logger.info('War simulated', summary);
  },
);
