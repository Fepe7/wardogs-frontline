import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';
import { getBytes, ref, uploadString } from 'firebase/storage';
import { afterAll, beforeAll, describe, it } from 'vitest';

/**
 * Clients only read, and only what their screens need (docs/ARQUITECTURA.md §7).
 * The documents are seeded with the rules disabled, the way the Admin SDK writes them.
 */

let env: RulesTestEnvironment;

const ANA = 'steam:76561198000000001'; // Valkyra
const LUIS = 'steam:76561198000000002'; // Lonestar
const NEWBIE = 'steam:76561198000000003'; // no allegiance yet
const MOD = 'steam:76561198000000009';

const anonymous = () => env.unauthenticatedContext().firestore();
const as = (uid: string) => env.authenticatedContext(uid).firestore();
const asModerator = () => env.authenticatedContext(MOD, { moderator: true }).firestore();

const allegiance = (faction: string) => ({ faction, since: new Date('2026-09-01') });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-frontline',
    firestore: { rules: await readFile('firestore.rules', 'utf8') },
    storage: { rules: await readFile('storage.rules', 'utf8') },
  });

  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const seed: Record<string, object> = {
      'war/map': { sectors: [] },
      'demo/clock': { offsetMs: 3600000 },
      'battles/b1': { status: 'open', attacker: 'valkyra', defender: 'lonestar' },
      'voteRounds/valkyra-1': { status: 'open', faction: 'valkyra', votes: [] },
      'voteRounds/lonestar-1': { status: 'open', faction: 'lonestar', votes: [] },
      [`players/${ANA}`]: { displayName: 'Ana', allegiance: allegiance('valkyra') },
      [`players/${LUIS}`]: { displayName: 'Luis', allegiance: allegiance('lonestar') },
      [`players/${NEWBIE}`]: { displayName: 'Newbie', allegiance: null },
      'matchReports/r1': { status: 'pending', reportedBy: ANA },
      'events/e1': { type: 'MatchApproved', processedBy: [] },
      'rateLimits/x': { count: 1 },
      'steamNonces/x': { expiresAt: new Date() },
    };
    await Promise.all(Object.entries(seed).map(([path, data]) => setDoc(doc(db, path), data)));
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('the war is public', () => {
  it('lets anyone read the map and a battle', async () => {
    await assertSucceeds(getDoc(doc(anonymous(), 'war/map')));
    await assertSucceeds(getDoc(doc(anonymous(), 'battles/b1')));
  });

  it('lets anyone list battles, but only with a limit', async () => {
    const battles = collection(anonymous(), 'battles');
    await assertSucceeds(getDocs(query(battles, where('status', '==', 'open'), limit(10))));
    await assertFails(getDocs(query(battles, where('status', '==', 'open'))));
    await assertFails(getDocs(query(battles, limit(51))));
  });
});

describe('the demo clock', () => {
  it('is public, so the web can show real times while the demo runs ahead', async () => {
    await assertSucceeds(getDoc(doc(anonymous(), 'demo/clock')));
  });
});

describe('votes are secret between factions', () => {
  const openRoundsOf = (db: ReturnType<typeof as>, faction: string) =>
    query(
      collection(db, 'voteRounds'),
      where('faction', '==', faction),
      where('status', '==', 'open'),
      limit(3),
    );

  it('lets a player read the rounds of their own faction', async () => {
    await assertSucceeds(getDoc(doc(as(ANA), 'voteRounds/valkyra-1')));
    await assertSucceeds(getDocs(openRoundsOf(as(ANA), 'valkyra')));
  });

  it('hides the rounds of the other factions', async () => {
    await assertFails(getDoc(doc(as(ANA), 'voteRounds/lonestar-1')));
    await assertFails(getDocs(openRoundsOf(as(ANA), 'lonestar')));
    await assertFails(getDocs(query(collection(as(ANA), 'voteRounds'), limit(3))));
  });

  it('hides every round from visitors and from players without a faction', async () => {
    await assertFails(getDoc(doc(anonymous(), 'voteRounds/valkyra-1')));
    await assertFails(getDoc(doc(as(NEWBIE), 'voteRounds/valkyra-1')));
  });

  it('only allows listing with a limit', async () => {
    const unlimited = query(collection(as(ANA), 'voteRounds'), where('faction', '==', 'valkyra'));
    await assertFails(getDocs(unlimited));
  });
});

describe('players', () => {
  it('can read their own profile', async () => {
    await assertSucceeds(getDoc(doc(as(ANA), `players/${ANA}`)));
  });

  it('cannot read anyone else, or list players', async () => {
    await assertFails(getDoc(doc(as(ANA), `players/${LUIS}`)));
    await assertFails(getDoc(doc(anonymous(), `players/${ANA}`)));
    await assertFails(getDocs(query(collection(as(ANA), 'players'), limit(10))));
  });

  it('can all be read by a moderator', async () => {
    await assertSucceeds(getDoc(doc(asModerator(), `players/${LUIS}`)));
  });
});

describe('match reports', () => {
  it('are readable by their author, one by one or as a limited list', async () => {
    await assertSucceeds(getDoc(doc(as(ANA), 'matchReports/r1')));
    await assertSucceeds(
      getDocs(
        query(collection(as(ANA), 'matchReports'), where('reportedBy', '==', ANA), limit(20)),
      ),
    );
  });

  it('are hidden from other players and visitors', async () => {
    await assertFails(getDoc(doc(as(LUIS), 'matchReports/r1')));
    await assertFails(getDoc(doc(anonymous(), 'matchReports/r1')));
    await assertFails(getDocs(query(collection(as(LUIS), 'matchReports'), limit(20))));
  });

  it('form the moderation queue for moderators', async () => {
    const queue = collection(asModerator(), 'matchReports');
    await assertSucceeds(getDocs(query(queue, where('status', '==', 'pending'), limit(20))));
    await assertFails(getDocs(query(queue, where('status', '==', 'pending'))));
  });
});

describe('server-only data', () => {
  it.each(['events/e1', 'rateLimits/x', 'steamNonces/x'])(
    'keeps %s hidden, even from moderators',
    async (path) => {
      await assertFails(getDoc(doc(asModerator(), path)));
    },
  );
});

describe('clients never write', () => {
  it.each([
    'war/map',
    'demo/clock',
    'battles/b1',
    'voteRounds/valkyra-1',
    `players/${ANA}`,
    'matchReports/r1',
    'matchReports/new',
    'events/e2',
  ])('denies writing %s, even to its owner or a moderator', async (path) => {
    await assertFails(setDoc(doc(as(ANA), path), { status: 'open' }));
    await assertFails(setDoc(doc(asModerator(), path), { status: 'open' }));
  });
});

describe('Storage rules (closed until screenshot uploads land)', () => {
  it('denies uploads even to signed-in players', async () => {
    const storage = env.authenticatedContext(ANA).storage();
    await assertFails(uploadString(ref(storage, `reports/${ANA}/any.png`), 'data'));
  });

  it('denies downloads to anonymous visitors', async () => {
    const storage = env.unauthenticatedContext().storage();
    await assertFails(getBytes(ref(storage, 'reports/any.png')));
  });
});
