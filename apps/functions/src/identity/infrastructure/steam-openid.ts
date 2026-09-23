import { err, ok, type Clock, type Result } from '@frontline/core';

export const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';

/** The `openid.*` parameters Steam appends to the return URL. */
export type SteamAssertion = Readonly<Record<string, string>>;

export type SteamLoginError = 'invalid-steam-assertion' | 'steam-unavailable';

export interface VerifiedSteamLogin {
  readonly steamId: string;
  /** Unique per login; the caller must make sure it is used only once. */
  readonly nonce: string;
}

export interface SteamOpenIdVerifier {
  verify(assertion: SteamAssertion): Promise<Result<VerifiedSteamLogin, SteamLoginError>>;
}

const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
// The nonce starts with the UTC time Steam issued it (OpenID 2.0 §10.1).
const NONCE_TIME = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/;
/** A login must be completed within this time after Steam issues it. */
const MAX_LOGIN_AGE_MS = 5 * 60 * 1000;
/** Tolerated clock difference between Steam and Cloud Functions. */
const MAX_CLOCK_SKEW_MS = 60 * 1000;
/** Fields Steam must have signed, or check_authentication would not vouch for them. */
const REQUIRED_SIGNED = ['op_endpoint', 'claimed_id', 'identity', 'return_to', 'response_nonce'];
const STEAM_TIMEOUT_MS = 10 * 1000;

const invalid = err('invalid-steam-assertion' as const);

const isFresh = (nonce: string, now: Date): boolean => {
  const issuedAt = NONCE_TIME.exec(nonce)?.[1];
  if (issuedAt === undefined) return false;
  const age = now.getTime() - Date.parse(issuedAt);
  return age <= MAX_LOGIN_AGE_MS && age >= -MAX_CLOCK_SKEW_MS;
};

/**
 * Local checks before asking Steam: the assertion must be a positive answer from Steam,
 * made for this site, recent, and with the account id covered by the signature.
 */
const checkAssertion = (
  assertion: SteamAssertion,
  returnTo: string,
  now: Date,
): Result<VerifiedSteamLogin, SteamLoginError> => {
  const param = (name: string) => assertion[`openid.${name}`];
  const claimedId = param('claimed_id');
  const nonce = param('response_nonce');
  const signed = param('signed')?.split(',') ?? [];

  if (param('mode') !== 'id_res' || param('sig') === undefined) return invalid;
  if (param('op_endpoint') !== STEAM_OPENID_ENDPOINT) return invalid;
  if (param('return_to') !== returnTo) return invalid;
  if (claimedId === undefined || param('identity') !== claimedId) return invalid;
  if (!REQUIRED_SIGNED.every((field) => signed.includes(field))) return invalid;
  if (nonce === undefined || !isFresh(nonce, now)) return invalid;

  const steamId = CLAIMED_ID.exec(claimedId)?.[1];
  if (steamId === undefined) return invalid;
  return ok({ steamId, nonce });
};

/**
 * Verifies a Steam OpenID 2.0 login. The signature is checked by Steam itself
 * (`check_authentication`), so nothing sent by the client is trusted until Steam
 * confirms it.
 */
export const steamOpenIdVerifier = ({
  returnTo,
  clock,
  fetch = globalThis.fetch,
}: {
  returnTo: string;
  clock: Clock;
  fetch?: typeof globalThis.fetch;
}): SteamOpenIdVerifier => ({
  verify: async (assertion) => {
    const checked = checkAssertion(assertion, returnTo, clock.now());
    if (!checked.ok) return checked;

    let answer: string;
    try {
      const response = await fetch(STEAM_OPENID_ENDPOINT, {
        method: 'POST',
        body: new URLSearchParams({ ...assertion, 'openid.mode': 'check_authentication' }),
        signal: AbortSignal.timeout(STEAM_TIMEOUT_MS),
      });
      if (!response.ok) return err('steam-unavailable');
      answer = await response.text();
    } catch {
      return err('steam-unavailable');
    }

    return answer.split('\n').includes('is_valid:true') ? checked : invalid;
  },
});
