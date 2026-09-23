import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Clock, Sector, SectorId } from '@frontline/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCallables, RATE_LIMITS } from './callables';
import { composeUseCases } from './composition';
import type { CallableInput } from './shared/handlers/callable';
import { firestoreRateLimiter } from './shared/infrastructure/firestore-rate-limiter';

/** Integration tests against the Firestore emulator (`pnpm test:integration`). */

const PROJECT_ID = 'demo-frontline';
const emulatorHost = process.env['FIRESTORE_EMULATOR_HOST'];
if (!emulatorHost) throw new Error('Run with the Firestore emulator: pnpm test:integration');

if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

const start = new Date('2026-10-01T18:00:00Z');
let now = start;
const clock: Clock = { now: () => now };
const useCases = composeUseCases(db, clock);
const callables = createCallables(db, useCases, firestoreRateLimiter(db, clock), {
  ...RATE_LIMITS,
  castVote: { ...RATE_LIMITS.castVote, max: 2 }, // small limit to test it quickly
});

const ANA = 'steam:76561198000000001';
const MOD = 'steam:76561198000000009';
const as = (uid: string, data: unknown, claims: Record<string, unknown> = {}): CallableInput => ({
  auth: { uid, token: claims, rawToken: 'test' } as unknown as CallableInput['auth'],
  data,
});
const anonymous = (data: unknown): CallableInput => ({ auth: undefined, data });

const sector = (id: string, q: number, r: number, owner: Sector['owner']): Sector => ({
  id: id as SectorId,
  name: id,
  coord: { q, r },
  owner,
});

const report = {
  placements: { first: 'valkyra', second: 'lonestar', third: 'manticore' },
  playedAt: '2026-10-01T17:00:00.000Z',
  screenshotPath: `reports/${ANA}/shot.png`,
};

beforeEach(async () => {
  now = start;
  const response = await fetch(
    `http://${emulatorHost}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!response.ok) throw new Error(`Could not clear the emulator: ${String(response.status)}`);

  await useCases.startWar({
    sectors: [
      sector('lonestar-hq', 0, 0, 'lonestar'),
      sector('lonestar-farm', 1, 0, 'lonestar'),
      sector('valkyra-farm', 2, 0, 'valkyra'),
      sector('manticore-farm', 1, 1, 'manticore'),
    ],
  });
  await useCases.signInPlayer({ steamId: ANA.replace('steam:', ''), displayName: 'Ana' });
});

describe('every callable', () => {
  it('rejects anonymous calls', async () => {
    await expect(
      callables.castVote(anonymous({ sectorId: 'lonestar-farm' })),
    ).rejects.toMatchObject({ code: 'unauthenticated', details: { reason: 'unauthenticated' } });
  });

  it('rejects requests that do not match the contract', async () => {
    await expect(callables.castVote(as(ANA, { sectorId: 42 }))).rejects.toMatchObject({
      code: 'invalid-argument',
      details: { reason: 'invalid-request' },
    });
  });
});

describe('swearAllegiance + castVote', () => {
  it("votes with the faction stored in the player's document", async () => {
    await callables.swearAllegiance(as(ANA, { faction: 'valkyra' }));

    await expect(callables.castVote(as(ANA, { sectorId: 'lonestar-farm' }))).resolves.toEqual({
      sectorId: 'lonestar-farm',
    });
  });

  it('refuses to vote before swearing allegiance', async () => {
    await expect(callables.castVote(as(ANA, { sectorId: 'lonestar-farm' }))).rejects.toMatchObject({
      code: 'failed-precondition',
      details: { reason: 'no-allegiance' },
    });
  });

  it('maps domain errors to a reason the web app can translate', async () => {
    await callables.swearAllegiance(as(ANA, { faction: 'valkyra' }));

    await expect(callables.castVote(as(ANA, { sectorId: 'lonestar-hq' }))).rejects.toMatchObject({
      code: 'failed-precondition',
      details: { reason: 'not-adjacent' },
    });
  });

  it('rate-limits votes per player', async () => {
    await callables.swearAllegiance(as(ANA, { faction: 'valkyra' }));
    await callables.castVote(as(ANA, { sectorId: 'lonestar-farm' }));
    await callables.castVote(as(ANA, { sectorId: 'manticore-farm' }));

    await expect(callables.castVote(as(ANA, { sectorId: 'lonestar-farm' }))).rejects.toMatchObject({
      code: 'resource-exhausted',
      details: { reason: 'rate-limited' },
    });
  });
});

describe('submitReport', () => {
  it('stores a pending report from the caller', async () => {
    const result = await callables.submitReport(as(ANA, report));

    const stored = await db.collection('matchReports').doc(result.reportId).get();
    expect(stored.get('status')).toBe('pending');
    expect(stored.get('reportedBy')).toBe(ANA);
  });

  it("refuses a screenshot outside the caller's own folder", async () => {
    const stolen = { ...report, screenshotPath: `reports/${MOD}/shot.png` };

    await expect(callables.submitReport(as(ANA, stolen))).rejects.toMatchObject({
      code: 'failed-precondition',
      details: { reason: 'invalid-screenshot-path' },
    });
  });
});

describe('moderation', () => {
  const submitted = async () => (await callables.submitReport(as(ANA, report))).reportId;

  it('is for moderators only', async () => {
    const reportId = await submitted();

    await expect(callables.approveReport(as(ANA, { reportId }))).rejects.toMatchObject({
      code: 'permission-denied',
      details: { reason: 'moderator-only' },
    });
  });

  it('lets a moderator approve a report', async () => {
    const reportId = await submitted();

    await expect(
      callables.approveReport(as(MOD, { reportId }, { moderator: true })),
    ).resolves.toEqual({ reportId, status: 'approved' });
  });

  it('does not let a moderator judge their own report', async () => {
    const reportId = await submitted();

    await expect(
      callables.rejectReport(as(ANA, { reportId, reason: 'mine' }, { moderator: true })),
    ).rejects.toMatchObject({ code: 'permission-denied', details: { reason: 'self-moderation' } });
  });

  it('reports an unknown report as not found', async () => {
    await expect(
      callables.approveReport(as(MOD, { reportId: 'nope' }, { moderator: true })),
    ).rejects.toMatchObject({ code: 'not-found', details: { reason: 'report-not-found' } });
  });

  it('needs a reason to reject', async () => {
    const reportId = await submitted();

    await expect(
      callables.rejectReport(as(MOD, { reportId }, { moderator: true })),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});
