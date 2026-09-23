import { describe, expect, it } from 'vitest';
import type { SteamId } from './steam-id';
import { registerPlayer, swearAllegiance, type Player } from './player';

const DAY_MS = 24 * 60 * 60 * 1000;
const registeredAt = new Date('2026-10-01T12:00:00Z');
const day = (days: number) => new Date(registeredAt.getTime() + days * DAY_MS);

const newPlayer = (): Player =>
  registerPlayer({ steamId: '76561198000000001' as SteamId, displayName: 'Ana' });

const sworn = (faction: 'lonestar' | 'valkyra' | 'manticore', at: Date): Player => {
  const result = swearAllegiance(newPlayer(), faction, at);
  if (!result.ok) throw new Error(result.error);
  return result.value.player;
};

describe('registerPlayer', () => {
  it('registers a player without a faction yet', () => {
    expect(newPlayer()).toEqual({
      id: 'steam:76561198000000001',
      steamId: '76561198000000001',
      displayName: 'Ana',
      allegiance: null,
    });
  });
});

describe('swearAllegiance', () => {
  it('lets a new player join a faction straight away, without emitting a change', () => {
    const result = swearAllegiance(newPlayer(), 'valkyra', day(0));
    if (!result.ok) throw new Error(result.error);

    expect(result.value.player.allegiance).toEqual({ faction: 'valkyra', since: day(0) });
    expect(result.value.event).toBeNull();
  });

  it('lets a player change faction once the 7-day cooldown has passed', () => {
    const result = swearAllegiance(sworn('valkyra', day(0)), 'lonestar', day(7));
    if (!result.ok) throw new Error(result.error);

    expect(result.value.player.allegiance).toEqual({ faction: 'lonestar', since: day(7) });
    expect(result.value.event).toEqual({
      type: 'AllegianceChanged',
      playerId: 'steam:76561198000000001',
      from: 'valkyra',
      to: 'lonestar',
      occurredAt: day(7),
    });
  });

  it('rejects a change before the 7-day cooldown has passed', () => {
    expect(swearAllegiance(sworn('valkyra', day(0)), 'lonestar', day(6.9))).toEqual({
      ok: false,
      error: 'allegiance-cooldown',
    });
  });

  it('rejects joining the faction the player already belongs to', () => {
    expect(swearAllegiance(sworn('valkyra', day(0)), 'valkyra', day(30))).toEqual({
      ok: false,
      error: 'already-in-faction',
    });
  });
});
