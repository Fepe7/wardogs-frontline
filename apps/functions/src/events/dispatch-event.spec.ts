import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Clock, PlayerId, Sector, SectorId } from '@frontline/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { composeUseCases } from '../composition';
import { COLLECTIONS } from '../shared/infrastructure/firestore-transaction';
import { dispatchEvent } from './dispatch-event';

/** Integration tests against the Firestore emulator (`pnpm test:integration`). */

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
const useCases = composeUseCases(db, clock);

const sector = (id: string, q: number, r: number, owner: Sector['owner']): Sector => ({
  id: id as SectorId,
  name: id,
  coord: { q, r },
  owner,
});
const lonestarFarm = 'lonestar-farm' as SectorId;

const eventIds = async (type: string): Promise<string[]> =>
  (await db.collection(COLLECTIONS.events).where('type', '==', type).get()).docs.map(
    (doc) => doc.id,
  );

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
});

describe('dispatchEvent', () => {
  it('scores an approved match in the open battle, exactly once, and records the consumer', async () => {
    now = at(1);
    await useCases.castVoteInRound({
      playerId: 'steam:1' as PlayerId,
      voterFaction: 'valkyra',
      sectorId: lonestarFarm,
    });
    now = at(24);
    await useCases.advanceWar();

    now = at(31);
    const report = await useCases.submitMatchReport({
      reportedBy: 'steam:111' as PlayerId,
      placements: { first: 'valkyra', second: 'manticore', third: 'lonestar' },
      playedAt: at(30),
      screenshotPath: 'reports/steam:111/shot.png',
    });
    if (!report.ok) throw new Error(report.error);
    await useCases.approveMatchReport({
      reportId: report.value.id,
      moderatorId: 'steam:999' as PlayerId,
    });
    const [eventId] = await eventIds('MatchApproved');
    if (!eventId) throw new Error('MatchApproved was not written to the outbox');

    const first = await dispatchEvent(db, useCases, eventId);
    const redelivered = await dispatchEvent(db, useCases, eventId);

    expect(first.delivered).toEqual(['war.scoreApprovedMatch']);
    expect(redelivered.delivered).toEqual([]);
    const event = await db.collection(COLLECTIONS.events).doc(eventId).get();
    expect(event.get('processedBy')).toEqual(['war.scoreApprovedMatch']);
    const battles = await db.collection(COLLECTIONS.battles).get();
    expect(battles.docs.map((doc) => doc.get('points') as unknown)).toEqual([
      { attacker: 3, defender: 1 },
    ]);
  });

  it('withdraws the open vote of a player who changes faction', async () => {
    const player = await useCases.signInPlayer({
      steamId: '76561198000000001',
      displayName: 'Ana',
    });
    if (!player.ok) throw new Error(player.error);
    await useCases.swearPlayerAllegiance({ playerId: player.value.id, faction: 'valkyra' });
    now = at(1);
    await useCases.castVoteInRound({
      playerId: player.value.id,
      voterFaction: 'valkyra',
      sectorId: lonestarFarm,
    });

    now = at(7 * 24);
    await useCases.swearPlayerAllegiance({ playerId: player.value.id, faction: 'lonestar' });
    const [eventId] = await eventIds('AllegianceChanged');
    if (!eventId) throw new Error('AllegianceChanged was not written to the outbox');

    const result = await dispatchEvent(db, useCases, eventId);

    expect(result.delivered).toEqual(['war.withdrawVote']);
    const rounds = await db
      .collection(COLLECTIONS.voteRounds)
      .where('faction', '==', 'valkyra')
      .where('status', '==', 'open')
      .get();
    expect(rounds.docs.map((doc) => doc.get('votes') as unknown)).toEqual([[]]);
  });

  it('refuses a document that is not a known integration event', async () => {
    await db.collection(COLLECTIONS.events).doc('bogus').set({ type: 'SomethingElse' });

    await expect(dispatchEvent(db, useCases, 'bogus')).rejects.toThrow('Unknown integration event');
  });
});
