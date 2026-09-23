import { beforeEach, describe, expect, it } from 'vitest';
import { fixedClock, inMemoryTransaction, InMemoryOutbox } from '../../shared/application/testing';
import type { PlayerId } from '../../shared/domain/player-id';
import { InMemoryPlayerRepository } from './in-memory-player-repository';
import { signInPlayer, swearPlayerAllegiance } from './player-use-cases';

const DAY_MS = 24 * 60 * 60 * 1000;
const start = new Date('2026-10-01T12:00:00Z');
const STEAM_ID = '76561198000000001';
const PLAYER_ID = 'steam:76561198000000001' as PlayerId;

let players: InMemoryPlayerRepository;
let outbox: InMemoryOutbox;

const depsAt = (days: number) => ({
  transaction: inMemoryTransaction({ players, outbox }),
  clock: fixedClock(new Date(start.getTime() + days * DAY_MS)),
});

beforeEach(() => {
  players = new InMemoryPlayerRepository();
  outbox = new InMemoryOutbox();
});

describe('signInPlayer', () => {
  it('registers a first-time player without a faction', async () => {
    const result = await signInPlayer(depsAt(0))({ steamId: STEAM_ID, displayName: 'Ana' });

    expect(result.ok && result.value).toMatchObject({ id: PLAYER_ID, allegiance: null });
    expect(await players.findById(PLAYER_ID)).not.toBeNull();
  });

  it('keeps a returning player and refreshes their Steam display name', async () => {
    await signInPlayer(depsAt(0))({ steamId: STEAM_ID, displayName: 'Ana' });
    await swearPlayerAllegiance(depsAt(0))({ playerId: PLAYER_ID, faction: 'valkyra' });

    const result = await signInPlayer(depsAt(1))({
      steamId: STEAM_ID,
      displayName: 'Ana the Bold',
    });

    expect(result.ok && result.value).toMatchObject({
      displayName: 'Ana the Bold',
      allegiance: { faction: 'valkyra' },
    });
  });

  it('rejects an invalid Steam id', async () => {
    const result = await signInPlayer(depsAt(0))({ steamId: 'not-a-steam-id', displayName: 'X' });

    expect(result).toEqual({ ok: false, error: 'invalid-steam-id' });
    expect(players.all()).toEqual([]);
  });
});

describe('swearPlayerAllegiance', () => {
  beforeEach(async () => {
    await signInPlayer(depsAt(0))({ steamId: STEAM_ID, displayName: 'Ana' });
  });

  it('stores the first oath without emitting an event', async () => {
    const result = await swearPlayerAllegiance(depsAt(0))({
      playerId: PLAYER_ID,
      faction: 'valkyra',
    });

    expect(result.ok && result.value.allegiance?.faction).toBe('valkyra');
    expect(outbox.events).toEqual([]);
  });

  it('stores a faction change and adds AllegianceChanged to the outbox', async () => {
    await swearPlayerAllegiance(depsAt(0))({ playerId: PLAYER_ID, faction: 'valkyra' });

    await swearPlayerAllegiance(depsAt(7))({ playerId: PLAYER_ID, faction: 'lonestar' });

    expect((await players.findById(PLAYER_ID))?.allegiance?.faction).toBe('lonestar');
    expect(outbox.events).toMatchObject([
      { type: 'AllegianceChanged', playerId: PLAYER_ID, from: 'valkyra', to: 'lonestar' },
    ]);
  });

  it('writes nothing while the cooldown is running', async () => {
    await swearPlayerAllegiance(depsAt(0))({ playerId: PLAYER_ID, faction: 'valkyra' });

    const result = await swearPlayerAllegiance(depsAt(3))({
      playerId: PLAYER_ID,
      faction: 'lonestar',
    });

    expect(result).toEqual({ ok: false, error: 'allegiance-cooldown' });
    expect((await players.findById(PLAYER_ID))?.allegiance?.faction).toBe('valkyra');
    expect(outbox.events).toEqual([]);
  });

  it('fails for an unknown player', async () => {
    const result = await swearPlayerAllegiance(depsAt(0))({
      playerId: 'steam:0' as PlayerId,
      faction: 'valkyra',
    });

    expect(result).toEqual({ ok: false, error: 'player-not-found' });
  });
});
