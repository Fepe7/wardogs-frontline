import { readFile } from 'node:fs/promises';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getBytes, ref, uploadString } from 'firebase/storage';
import { afterAll, beforeAll, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-frontline',
    firestore: { rules: await readFile('firestore.rules', 'utf8') },
    storage: { rules: await readFile('storage.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('Firestore rules (closed by default)', () => {
  it('denies reads to anonymous visitors', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'battles/any')));
  });

  it('denies writes even to signed-in players', async () => {
    const db = env.authenticatedContext('steam:76561198000000000').firestore();
    await assertFails(setDoc(doc(db, 'battles/any'), { attacker: 'valkyra' }));
  });
});

describe('Storage rules (closed by default)', () => {
  it('denies uploads even to signed-in players', async () => {
    const storage = env.authenticatedContext('steam:76561198000000000').storage();
    await assertFails(uploadString(ref(storage, 'reports/any.png'), 'data'));
  });

  it('denies downloads to anonymous visitors', async () => {
    const storage = env.unauthenticatedContext().storage();
    await assertFails(getBytes(ref(storage, 'reports/any.png')));
  });
});
