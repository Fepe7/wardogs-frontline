import { describe, expect, it } from 'vitest';
import { createSteamId, playerIdOf, type SteamId } from './steam-id';

describe('SteamId', () => {
  it('accepts a valid SteamID64', () => {
    expect(createSteamId('76561198000000001')).toEqual({ ok: true, value: '76561198000000001' });
  });

  it('rejects values that are not a SteamID64', () => {
    for (const raw of [
      '',
      '123',
      '7656119800000000',
      '765611980000000011',
      '86561198000000001',
      '7656119800000000a',
    ]) {
      expect(createSteamId(raw)).toEqual({ ok: false, error: 'invalid-steam-id' });
    }
  });

  it('derives the player id used across the app', () => {
    expect(playerIdOf('76561198000000001' as SteamId)).toBe('steam:76561198000000001');
  });
});
