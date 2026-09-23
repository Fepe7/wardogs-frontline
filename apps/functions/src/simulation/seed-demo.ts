import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GAME_CONFIG, type Clock } from '@frontline/core';
import { composeUseCases } from '../composition';
import { dispatchEvent } from '../events/dispatch-event';
import { COLLECTIONS } from '../shared/infrastructure/firestore-transaction';
import { simulateWar } from './simulate-war';

/**
 * Local only (`pnpm emulators`, then `pnpm seed:demo`): fills the Firestore emulator
 * with a war in progress so the web has something to show, because scheduled jobs do
 * not run in the emulator. A `demo-*` project can never reach real Firebase resources.
 *
 * It replays the demo from 90 minutes ago: the war starts, the bots vote, the rounds
 * close into battles 30 minutes ago, and simulated matches score them until now.
 */
const MINUTE_MS = 60 * 1000;
const PROJECT_ID = 'demo-frontline';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';
// Without it, the Admin SDK tries to discover the project on Google Cloud and warns.
process.env['GCLOUD_PROJECT'] ??= PROJECT_ID;
initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

const warStartsAt = Date.now() - 90 * MINUTE_MS;
let elapsedMs = 0;
const clock: Clock = { now: () => new Date(warStartsAt + elapsedMs) };
const useCases = composeUseCases(db, clock, GAME_CONFIG.pace.demo);
const tick = simulateWar({ ...useCases, clock, random: Math.random });

if ((await useCases.readWar()).sectors !== null) {
  console.log('The emulator already has a war. Restart the emulators to seed a new one.');
  process.exit(0);
}

await tick();
elapsedMs = GAME_CONFIG.pace.demo.voteRoundHours * 60 * MINUTE_MS;
await useCases.advanceWar();
for (let minutes = 65; minutes <= 90; minutes += 5) {
  elapsedMs = minutes * MINUTE_MS;
  await tick();
}

// No trigger runs here unless the Functions emulator is up; dispatching is idempotent.
const events = await db.collection(COLLECTIONS.events).get();
for (const event of events.docs) await dispatchEvent(db, useCases, event.id);

const { openBattles } = await useCases.readWar();
console.log(`Demo war seeded: ${String(openBattles.length)} battles in progress.`);
