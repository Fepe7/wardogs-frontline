import { describe, expect, it } from 'vitest';
import { STEAM_OPENID_ENDPOINT, steamOpenIdVerifier, type SteamAssertion } from './steam-openid';

const RETURN_TO = 'https://frontline.example/auth/steam';
const now = new Date('2026-10-01T18:00:00Z');
const clock = { now: () => now };

const assertion = (overrides: Record<string, string> = {}): SteamAssertion => ({
  'openid.ns': 'http://specs.openid.net/auth/2.0',
  'openid.mode': 'id_res',
  'openid.op_endpoint': STEAM_OPENID_ENDPOINT,
  'openid.claimed_id': 'https://steamcommunity.com/openid/id/76561198000000001',
  'openid.identity': 'https://steamcommunity.com/openid/id/76561198000000001',
  'openid.return_to': RETURN_TO,
  'openid.response_nonce': '2026-10-01T17:59:30ZabcDEF123',
  'openid.assoc_handle': '1234567890',
  'openid.signed': 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
  'openid.sig': 'c2lnbmF0dXJl',
  ...overrides,
});

/** Fake Steam endpoint that records what it was asked and answers `is_valid`. */
const steamAnswering = (body: string | Error) => {
  const requests: URLSearchParams[] = [];
  const fetch = (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    requests.push(new URLSearchParams(init?.body as URLSearchParams));
    return body instanceof Error ? Promise.reject(body) : Promise.resolve(new Response(body));
  };
  return { fetch, requests };
};

const VALID = 'ns:http://specs.openid.net/auth/2.0\nis_valid:true\n';
const verifierWith = (steam: ReturnType<typeof steamAnswering>) =>
  steamOpenIdVerifier({ returnTo: RETURN_TO, clock, fetch: steam.fetch });

describe('Steam OpenID verification', () => {
  it('trusts the Steam id once Steam confirms the signature', async () => {
    const steam = steamAnswering(VALID);

    const result = await verifierWith(steam).verify(assertion());

    expect(result).toEqual({
      ok: true,
      value: { steamId: '76561198000000001', nonce: '2026-10-01T17:59:30ZabcDEF123' },
    });
    expect(steam.requests[0]?.get('openid.mode')).toBe('check_authentication');
    expect(steam.requests[0]?.get('openid.sig')).toBe('c2lnbmF0dXJl');
  });

  it('rejects the login when Steam does not confirm the signature', async () => {
    const result = await verifierWith(steamAnswering('is_valid:false\n')).verify(assertion());

    expect(result).toEqual({ ok: false, error: 'invalid-steam-assertion' });
  });

  it('reports Steam as unavailable when it cannot be reached', async () => {
    const result = await verifierWith(steamAnswering(new Error('timeout'))).verify(assertion());

    expect(result).toEqual({ ok: false, error: 'steam-unavailable' });
  });

  it.each([
    ['a cancelled login', { 'openid.mode': 'cancel' }],
    ['another provider', { 'openid.op_endpoint': 'https://evil.example/openid/login' }],
    ['a login made for another site', { 'openid.return_to': 'https://evil.example/auth/steam' }],
    [
      'a claimed id that is not a Steam account',
      { 'openid.claimed_id': 'https://evil.example/openid/id/76561198000000001' },
    ],
    [
      'an identity different from the claimed id',
      { 'openid.identity': 'https://steamcommunity.com/openid/id/76561198000000002' },
    ],
    [
      'a claimed id outside the signature',
      { 'openid.signed': 'signed,op_endpoint,identity,return_to,response_nonce,assoc_handle' },
    ],
    ['an expired login', { 'openid.response_nonce': '2026-10-01T17:50:00Zabc' }],
    ['a nonce from the future', { 'openid.response_nonce': '2026-10-01T18:05:00Zabc' }],
    ['a malformed nonce', { 'openid.response_nonce': 'not-a-date' }],
  ])('rejects %s without asking Steam', async (_case, overrides) => {
    const steam = steamAnswering(VALID);

    const result = await verifierWith(steam).verify(assertion(overrides));

    expect(result).toEqual({ ok: false, error: 'invalid-steam-assertion' });
    expect(steam.requests).toHaveLength(0);
  });

  it('rejects an assertion with a missing parameter', async () => {
    const unsigned = Object.fromEntries(
      Object.entries(assertion()).filter(([key]) => key !== 'openid.sig'),
    );

    const result = await verifierWith(steamAnswering(VALID)).verify(unsigned);

    expect(result).toEqual({ ok: false, error: 'invalid-steam-assertion' });
  });
});
