import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { attackableSectors, GAME_CONFIG, type Clock } from '@frontline/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { composeUseCases } from '../composition';
import { COLLECTIONS } from '../shared/infrastructure/firestore-transaction';
import { simulateWar } from './simulate-war';

/** Integration tests against the Firestore emulator (`pnpm test:integration`). */

const PROJECT_ID = 'demo-frontline';
const emulatorHost = process.env['FIRESTORE_EMULATOR_HOST'];
if (!emulatorHost) throw new Error('Run with the Firestore emulator: pnpm test:integration');

if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

const HOUR_MS = 60 * 60 * 1000;
const start = new Date('2026-10-01T18:00:00Z');
let now = start;
const clock: Clock = { now: () => now };
const useCases = composeUseCases(db, clock, GAME_CONFIG.pace.demo);

// Deterministic "dice": cycles through a fixed sequence.
const dice = (...rolls: number[]) => {
  let index = 0;
  return () => rolls[index++ % rolls.length] ?? 0;
};
const run = (random = dice(0.1, 0.5, 0.9)) => simulateWar({ ...useCases, clock, random })();

const approvedMatches = async () =>
  (await db.collection(COLLECTIONS.events).where('type', '==', 'MatchApproved').get()).docs;

beforeEach(async () => {
  now = start;
  const response = await fetch(
    `http://${emulatorHost}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!response.ok) throw new Error(`Could not clear the emulator: ${String(response.status)}`);
});

describe('the demo war simulator', () => {
  it('starts the war on the initial map the first time it runs', async () => {
    const summary = await run();

    const war = await useCases.readWar();
    expect(summary.startedWar).toBe(true);
    expect(war.sectors).toHaveLength(36);
    expect(war.openRounds).toHaveLength(3);
  });

  it('casts one bot vote per faction and round, for a sector the faction can attack', async () => {
    await run();
    const second = await run();

    const { sectors, openRounds } = await useCases.readWar();
    expect(second.botVotes).toBe(0);
    for (const round of openRounds) {
      expect(round.votes).toHaveLength(1);
      expect(round.votes[0]?.playerId).toBe(`bot:${round.faction}`);
      const targets = attackableSectors(sectors ?? [], round.faction).map((s) => s.id);
      expect(targets).toContain(round.votes[0]?.sectorId);
    }
  });

  it('plays one match with random placements every time it runs', async () => {
    await run();
    await run();

    const matches = await approvedMatches();
    expect(matches).toHaveLength(2);
    const placements = matches[0]?.get('placements') as Record<string, string>;
    expect(new Set(Object.values(placements)).size).toBe(3);
  });

  it('keeps the war moving at the demo pace: bot votes turn into 3 h battles', async () => {
    await run();

    now = new Date(start.getTime() + HOUR_MS);
    await useCases.advanceWar();

    const { openBattles } = await useCases.readWar();
    expect(openBattles.length).toBeGreaterThan(0);
    for (const battle of openBattles) {
      expect(battle.endsAt.getTime() - battle.startsAt.getTime()).toBe(3 * HOUR_MS);
    }
  });
});
