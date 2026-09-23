import { err, ok, type Result } from '@frontline/core';
import { z } from 'zod';

export interface SteamProfiles {
  /** Public Steam name of the account. */
  displayNameOf(steamId: string): Promise<Result<string, 'steam-unavailable'>>;
}

const PLAYER_SUMMARIES_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';
const STEAM_TIMEOUT_MS = 10 * 1000;

// Only what we store (docs/ARQUITECTURA.md §7, minimal data). Steam caps names at 32.
const playerSummaries = z.object({
  response: z.object({
    players: z.array(z.object({ steamid: z.string(), personaname: z.string().min(1).max(64) })),
  }),
});

/** Steam Web API adapter. The key is a secret: it goes in the URL, so the URL is never logged. */
export const steamWebApiProfiles = ({
  apiKey,
  fetch = globalThis.fetch,
}: {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
}): SteamProfiles => ({
  displayNameOf: async (steamId) => {
    const url = `${PLAYER_SUMMARIES_URL}?${new URLSearchParams({ key: apiKey, steamids: steamId }).toString()}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(STEAM_TIMEOUT_MS) });
      if (!response.ok) return err('steam-unavailable');

      const parsed = playerSummaries.safeParse(await response.json());
      const player = parsed.data?.response.players.find((p) => p.steamid === steamId);
      return player ? ok(player.personaname) : err('steam-unavailable');
    } catch {
      return err('steam-unavailable');
    }
  },
});
