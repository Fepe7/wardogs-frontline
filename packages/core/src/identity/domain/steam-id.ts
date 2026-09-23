import type { Brand } from '../../shared/domain/brand';
import type { PlayerId } from '../../shared/domain/player-id';
import { err, ok, type Result } from '../../shared/domain/result';

/** 64-bit Steam account id, e.g. 76561198000000001. */
export type SteamId = Brand<string, 'SteamId'>;

// Individual accounts: 17 digits starting with the public universe prefix.
const STEAM_ID_64 = /^7656119\d{10}$/;

export const createSteamId = (raw: string): Result<SteamId, 'invalid-steam-id'> =>
  STEAM_ID_64.test(raw) ? ok(raw as SteamId) : err('invalid-steam-id');

export const playerIdOf = (steamId: SteamId): PlayerId => `steam:${steamId}` as PlayerId;
