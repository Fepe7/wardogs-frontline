import { GAME_CONFIG } from '../../config/game';
import type { Faction } from '../../shared/domain/faction';
import type { AllegianceChanged } from '../../shared/domain/integration-events';
import type { PlayerId } from '../../shared/domain/player-id';
import { err, ok, type Result } from '../../shared/domain/result';
import { playerIdOf, type SteamId } from './steam-id';

export interface Allegiance {
  readonly faction: Faction;
  readonly since: Date;
}

export interface Player {
  readonly id: PlayerId;
  readonly steamId: SteamId;
  readonly displayName: string;
  /** Null until the player swears allegiance to a faction. */
  readonly allegiance: Allegiance | null;
}

export type AllegianceError = 'already-in-faction' | 'allegiance-cooldown';

const DAY_MS = 24 * 60 * 60 * 1000;

export const registerPlayer = (params: { steamId: SteamId; displayName: string }): Player => ({
  id: playerIdOf(params.steamId),
  steamId: params.steamId,
  displayName: params.displayName,
  allegiance: null,
});

/**
 * Joins a faction. The first oath is free; changing sides requires the cooldown to
 * have passed since the last one, and emits AllegianceChanged so the war can drop
 * the player's vote in the faction they leave.
 */
export const swearAllegiance = (
  player: Player,
  faction: Faction,
  now: Date,
): Result<{ player: Player; event: AllegianceChanged | null }, AllegianceError> => {
  const current = player.allegiance;
  const allegiance: Allegiance = { faction, since: now };

  if (current === null) return ok({ player: { ...player, allegiance }, event: null });
  if (current.faction === faction) return err('already-in-faction');

  const cooldownEndsAt =
    current.since.getTime() + GAME_CONFIG.allegianceChangeCooldownDays * DAY_MS;
  if (now.getTime() < cooldownEndsAt) return err('allegiance-cooldown');

  return ok({
    player: { ...player, allegiance },
    event: {
      type: 'AllegianceChanged',
      playerId: player.id,
      from: current.faction,
      to: faction,
      occurredAt: now,
    },
  });
};
