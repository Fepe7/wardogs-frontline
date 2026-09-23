import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import {
  advanceWar,
  approveMatchReport,
  castVoteInRound,
  scoreApprovedMatch,
  signInPlayer,
  startWar,
  submitMatchReport,
  swearPlayerAllegiance,
  type Clock,
  type MatchApproved,
  type PlayerId,
  type Sector,
  type SectorId,
} from '@frontline/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { identityContext } from './identity/infrastructure/firestore-identity';
import { matchesContext } from './matches/infrastructure/firestore-matches';
import {
  COLLECTIONS,
  firestoreIds,
  firestoreTransaction,
} from './shared/infrastructure/firestore-transaction';
import { warContext } from './war/infrastructure/firestore-war';

/**
 * Integration tests against the Firestore emulator (`pnpm test:integration`).
 * They run the real use cases through real Firestore transactions, which enforce
 * rules the in-memory adapters cannot, such as "every read before any write".
 */

const PROJECT_ID = 'demo-frontline';
const emulatorHost = process.env['FIRESTORE_EMULATOR_HOST'];
if (!emulatorHost) throw new Error('Run with the Firestore emulator: pnpm test:integration');

if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

const HOUR_MS = 60 * 60 * 1000;
const start = new Date('2026-10-01T18:00:00Z');
const at = (hours: number) => new Date(start.getTime() + hours * HOUR_MS);
let now = start;
const clock: Clock = { now: () => now };

const matchesDeps = () => ({
  transaction: firestoreTransaction(db, matchesContext(db)),
  clock,
  ids: firestoreIds(db),
});
const identityDeps = () => ({
  transaction: firestoreTransaction(db, identityContext(db)),
  clock,
});
const warDeps = () => ({
  transaction: firestoreTransaction(db, warContext(db)),
  clock,
  ids: firestoreIds(db),
});

beforeEach(async () => {
  now = start;
  const response = await fetch(
    `http://${emulatorHost}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!response.ok) throw new Error(`Could not clear the emulator: ${String(response.status)}`);
});

describe('Firestore transactions', () => {
  it('reject reads after writes, the rule the in-memory adapters cannot check', async () => {
    const attempt = db.runTransaction(async (transaction) => {
      transaction.set(db.collection('probe').doc('a'), { value: 1 });
      await transaction.get(db.collection('probe').doc('b'));
    });

    await expect(attempt).rejects.toThrow(/reads.*before.*writes/i);
  });
});

describe('matches on Firestore', () => {
  it('approves a report and writes MatchApproved to the outbox in the same transaction', async () => {
    const submitted = await submitMatchReport(matchesDeps())({
      reportedBy: 'steam:111' as PlayerId,
      placements: { first: 'valkyra', second: 'lonestar', third: 'manticore' },
      playedAt: at(-1),
      screenshotPath: 'reports/steam:111/shot.png',
    });
    if (!submitted.ok) throw new Error(submitted.error);

    const approved = await approveMatchReport(matchesDeps())({
      reportId: submitted.value.id,
      moderatorId: 'steam:999' as PlayerId,
    });

    expect(approved.ok).toBe(true);
    const stored = await db.collection(COLLECTIONS.matchReports).doc(submitted.value.id).get();
    expect(stored.get('status')).toBe('approved');
    expect(stored.get('playedAt')).toBeInstanceOf(Timestamp);

    const events = await db.collection(COLLECTIONS.events).get();
    expect(events.docs.map((doc) => doc.data())).toMatchObject([
      { type: 'MatchApproved', reportId: submitted.value.id, processedBy: [] },
    ]);
  });
});

describe('identity on Firestore', () => {
  it('stores players and adds AllegianceChanged to the outbox on a faction change', async () => {
    const signedIn = await signInPlayer(identityDeps())({
      steamId: '76561198000000001',
      displayName: 'Ana',
    });
    if (!signedIn.ok) throw new Error(signedIn.error);
    const playerId = signedIn.value.id;

    await swearPlayerAllegiance(identityDeps())({ playerId, faction: 'valkyra' });
    now = at(7 * 24);
    const changed = await swearPlayerAllegiance(identityDeps())({ playerId, faction: 'lonestar' });

    expect(changed.ok && changed.value.allegiance).toEqual({ faction: 'lonestar', since: at(168) });
    const events = await db.collection(COLLECTIONS.events).get();
    expect(events.docs.map((doc) => doc.get('type') as string)).toEqual(['AllegianceChanged']);
  });
});

describe('war on Firestore', () => {
  const sector = (id: string, q: number, r: number, owner: Sector['owner']): Sector => ({
    id: id as SectorId,
    name: id,
    coord: { q, r },
    owner,
  });
  const lonestarFarm = 'lonestar-farm' as SectorId;

  it('runs a full cycle: vote, battle, scoring and conquest, through real transactions', async () => {
    const started = await startWar(warDeps())({
      sectors: [
        sector('lonestar-hq', 0, 0, 'lonestar'),
        sector('lonestar-farm', 1, 0, 'lonestar'),
        sector('valkyra-farm', 2, 0, 'valkyra'),
        sector('manticore-farm', 1, 1, 'manticore'),
      ],
    });
    expect(started.ok).toBe(true);

    now = at(1);
    const voted = await castVoteInRound(warDeps())({
      playerId: 'steam:1' as PlayerId,
      voterFaction: 'valkyra',
      sectorId: lonestarFarm,
    });
    expect(voted.ok).toBe(true);

    now = at(24);
    expect(await advanceWar(warDeps())()).toEqual({ resolvedBattles: 0, closedRounds: 3 });

    const match: MatchApproved = {
      type: 'MatchApproved',
      reportId: 'report-1',
      placements: { first: 'valkyra', second: 'manticore', third: 'lonestar' },
      playedAt: at(30),
      occurredAt: at(31),
    };
    await scoreApprovedMatch(warDeps())(match);
    await scoreApprovedMatch(warDeps())(match); // redelivered event: must not count twice

    now = at(72);
    expect((await advanceWar(warDeps())()).resolvedBattles).toBe(1);

    const map = await db.collection(COLLECTIONS.war).doc('map').get();
    const sectors = map.get('sectors') as Sector[];
    expect(sectors.find((s) => s.id === lonestarFarm)?.owner).toBe('valkyra');

    const battles = await db.collection(COLLECTIONS.battles).get();
    expect(battles.docs.map((doc) => doc.data())).toMatchObject([
      { status: 'resolved', winner: 'valkyra', points: { attacker: 3, defender: 1 } },
    ]);
  });
});
