import { describe, expect, it } from 'vitest';
import { steamWebApiProfiles } from './steam-profiles';

const STEAM_ID = '76561198000000001';

const steamReturning = (answer: Response | Error) => {
  const urls: string[] = [];
  const fetch = (url: string | URL | Request): Promise<Response> => {
    urls.push(url as string);
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  return { fetch, urls };
};

const summaries = (players: unknown[]) => Response.json({ response: { players } });

describe('Steam profiles', () => {
  it('reads the public name of the account', async () => {
    const steam = steamReturning(summaries([{ steamid: STEAM_ID, personaname: 'Ana' }]));

    const name = await steamWebApiProfiles({ apiKey: 'k3y', fetch: steam.fetch }).displayNameOf(
      STEAM_ID,
    );

    expect(name).toEqual({ ok: true, value: 'Ana' });
    expect(new URL(steam.urls[0] ?? '').searchParams.get('steamids')).toBe(STEAM_ID);
  });

  it.each([
    ['the account is missing', summaries([])],
    ['the answer is malformed', Response.json({ players: 'nope' })],
    ['Steam fails', new Response('', { status: 503 })],
    ['Steam cannot be reached', new Error('timeout')],
  ])('reports Steam as unavailable when %s', async (_case, answer) => {
    const steam = steamReturning(answer);

    const name = await steamWebApiProfiles({ apiKey: 'k3y', fetch: steam.fetch }).displayNameOf(
      STEAM_ID,
    );

    expect(name).toEqual({ ok: false, error: 'steam-unavailable' });
  });
});
