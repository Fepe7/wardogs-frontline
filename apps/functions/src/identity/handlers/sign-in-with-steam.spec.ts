import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { err, ok, type Clock } from '@frontline/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { composeUseCases } from '../../composition';
import { readPlayer } from '../infrastructure/firestore-identity';
import { firestoreSteamNonces } from '../infrastructure/firestore-steam-nonces';
import { STEAM_OPENID_ENDPOINT, steamOpenIdVerifier } from '../infrastructure/steam-openid';
import type { SteamProfiles } from '../infrastructure/steam-profiles';
import { signInWithSteam } from './sign-in-with-steam';

/** Integration tests against the Firestore and Auth emulators (`pnpm test:integration`). */

const PROJECT_ID = 'demo-frontline';
const emulatorHost = process.env['FIRESTORE_EMULATOR_HOST'];
if (!emulatorHost || !process.env['FIREBASE_AUTH_EMULATOR_HOST']) {
  throw new Error('Run with the Firestore and Auth emulators: pnpm test:integration');
}

if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

const RETURN_TO = 'https://frontline.example/auth/steam';
const STEAM_ID = '76561198000000001';
const PLAYER_ID = `steam:${STEAM_ID}`;
const now = new Date('2026-10-01T18:00:00Z');
const clock: Clock = { now: () => now };
const useCases = composeUseCases(db, clock);

const assertion = (nonce = '2026-10-01T17:59:30Zabc') => ({
  'openid.ns': 'http://specs.openid.net/auth/2.0',
  'openid.mode': 'id_res',
  'openid.op_endpoint': STEAM_OPENID_ENDPOINT,
  'openid.claimed_id': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
  'openid.identity': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
  'openid.return_to': RETURN_TO,
  'openid.response_nonce': nonce,
  'openid.assoc_handle': '1234567890',
  'openid.signed': 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
  'openid.sig': 'c2lnbmF0dXJl',
});

/** Steam, faked at the HTTP boundary: the real verifier runs against it. */
let steamSays: string | Error;
const steamFetch = ((): Promise<Response> =>
  steamSays instanceof Error
    ? Promise.reject(steamSays)
    : Promise.resolve(new Response(steamSays))) as typeof globalThis.fetch;

let steamName = 'Ana';
const profiles: SteamProfiles = {
  displayNameOf: () => Promise.resolve(steamName ? ok(steamName) : err('steam-unavailable')),
};

const handler = signInWithSteam({
  verifier: steamOpenIdVerifier({ returnTo: RETURN_TO, clock, fetch: steamFetch }),
  nonces: firestoreSteamNonces(db, clock),
  profiles,
  signInPlayer: useCases.signInPlayer,
  createToken: (uid) => getAuth().createCustomToken(uid),
});
const call = (data: unknown) => handler({ auth: undefined, data });

/** The emulator issues unsigned tokens; we only read who they are for. */
const uidOf = (token: string): unknown =>
  (JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as { uid?: unknown })
    .uid;

const reasonOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => 'no error',
    (error: unknown) => {
      const { code, details } = error as { code: string; details: { reason: string } };
      return `${code}: ${details.reason}`;
    },
  );

beforeEach(async () => {
  steamSays = 'ns:http://specs.openid.net/auth/2.0\nis_valid:true\n';
  steamName = 'Ana';
  const response = await fetch(
    `http://${emulatorHost}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!response.ok) throw new Error(`Could not clear the emulator: ${String(response.status)}`);
});

describe('signing in with Steam', () => {
  it('registers a first-time player with their Steam name and returns their token', async () => {
    const { token } = await call({ assertion: assertion() });

    expect(uidOf(token)).toBe(PLAYER_ID);
    expect(await readPlayer(db, PLAYER_ID as never)).toMatchObject({
      steamId: STEAM_ID,
      displayName: 'Ana',
      allegiance: null,
    });
  });

  it('keeps the name of a returning player up to date', async () => {
    await call({ assertion: assertion('2026-10-01T17:59:00Za') });
    steamName = 'Ana the Bold';

    await call({ assertion: assertion('2026-10-01T17:59:30Zb') });

    expect((await readPlayer(db, PLAYER_ID as never))?.displayName).toBe('Ana the Bold');
  });

  it('rejects a login that is replayed', async () => {
    await call({ assertion: assertion() });

    expect(await reasonOf(call({ assertion: assertion() }))).toBe(
      'unauthenticated: invalid-steam-assertion',
    );
  });

  it('rejects a login Steam does not confirm, without registering anyone', async () => {
    steamSays = 'is_valid:false\n';

    expect(await reasonOf(call({ assertion: assertion() }))).toBe(
      'unauthenticated: invalid-steam-assertion',
    );
    expect(await readPlayer(db, PLAYER_ID as never)).toBeNull();
  });

  it('tells the player to retry when Steam is down', async () => {
    steamSays = new Error('timeout');

    expect(await reasonOf(call({ assertion: assertion() }))).toBe('unavailable: steam-unavailable');
  });

  it('rejects a malformed request', async () => {
    expect(await reasonOf(call({ assertion: { token: 'x' } }))).toBe(
      'invalid-argument: invalid-request',
    );
  });
});
