import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GAME_CONFIG, type Clock } from '@frontline/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { RATE_LIMITS } from '../callables';
import { composeUseCases } from '../composition';
import { firestoreRateLimiter } from '../shared/infrastructure/firestore-rate-limiter';
import { readDemoOffset, shiftedClock } from './demo-clock';
import { fastForwardDemo, fastForwardDemoCallable } from './fast-forward';
import { simulateWar } from './simulate-war';

/** Integration tests against the Firestore emulator (`pnpm test:integration`). */

const PROJECT_ID = 'demo-frontline';
const emulatorHost = process.env['FIRESTORE_EMULATOR_HOST'];
if (!emulatorHost) throw new Error('Run with the Firestore emulator: pnpm test:integration');

if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

const HOUR_MS = 60 * 60 * 1000;
const realNow = new Date('2026-10-01T18:00:00Z');
const realClock: Clock = { now: () => realNow };
const pace = GAME_CONFIG.pace.demo;
const press = fastForwardDemo({ db, clock: realClock, pace, random: Math.random });

/** What the scheduled jobs see: the demo clock, as index.ts wires it. */
const warNow = async () => {
  const clock = shiftedClock(realClock, await readDemoOffset(db));
  return { clock, useCases: composeUseCases(db, clock, pace) };
};

const callable = (demoMode: boolean, max = 2) =>
  fastForwardDemoCallable({
    demoMode,
    rateLimiter: firestoreRateLimiter(db, realClock),
    rateLimit: { ...RATE_LIMITS.fastForwardDemo, max },
    run: press,
  });
const call = (demoMode: boolean, max?: number) =>
  callable(
    demoMode,
    max,
  )({ auth: undefined, data: {} }).then(
    () => 'ok',
    (error: unknown) => (error as { details: { reason: string } }).details.reason,
  );

beforeEach(async () => {
  const response = await fetch(
    `http://${emulatorHost}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!response.ok) throw new Error(`Could not clear the emulator: ${String(response.status)}`);

  // The demo war as the simulator job starts it: map, first rounds and bot votes.
  const { clock, useCases } = await warNow();
  await simulateWar({ ...useCases, clock, random: Math.random })();
});

describe('fast-forwarding the demo war', () => {
  it('moves the demo clock an hour ahead', async () => {
    await press();

    expect(await readDemoOffset(db)).toBe(HOUR_MS);
  });

  it('closes the vote rounds that end in that hour, so the bot votes become battles', async () => {
    const summary = await press();

    const { useCases } = await warNow();
    const { openBattles } = await useCases.readWar();
    expect(summary.closedRounds).toBeGreaterThanOrEqual(3);
    expect(openBattles.length).toBeGreaterThan(0);
  });

  it('plays and scores one match every 10 minutes of the skipped hour', async () => {
    await press(); // battles open at the end of this hour
    const summary = await press();

    const { useCases } = await warNow();
    const { openBattles } = await useCases.readWar();
    expect(summary.matches).toBe(6);
    for (const battle of openBattles) {
      expect(battle.points.attacker + battle.points.defender).toBeGreaterThan(0);
    }
  });

  it('resolves the battles once their 3 hours have passed', async () => {
    let resolved = 0;
    for (let hour = 0; hour < 4; hour += 1) resolved += (await press()).resolvedBattles;

    expect(resolved).toBeGreaterThan(0);
  });

  it('only works in the demo', async () => {
    expect(await call(false)).toBe('demo-only');
    expect(await readDemoOffset(db)).toBe(0);
  });

  it('is limited for everyone together, since nobody needs to sign in to press it', async () => {
    expect(await call(true, 2)).toBe('ok');
    expect(await call(true, 2)).toBe('ok');
    expect(await call(true, 2)).toBe('rate-limited');
  });
});
