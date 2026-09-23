import type { Clock, TransactionRunner } from '../../shared/application/ports';
import type { Faction } from '../../shared/domain/faction';
import type { PlayerId } from '../../shared/domain/player-id';
import { err, ok, type Result } from '../../shared/domain/result';
import {
  registerPlayer,
  swearAllegiance,
  type AllegianceError,
  type Player,
} from '../domain/player';
import { createSteamId, playerIdOf } from '../domain/steam-id';
import type { IdentityTransactionContext } from './ports';

interface IdentityDeps {
  readonly transaction: TransactionRunner<IdentityTransactionContext>;
  readonly clock: Clock;
}

/**
 * Called after Steam has verified the login. Registers first-time players and keeps
 * the Steam display name of returning players up to date.
 */
export const signInPlayer =
  ({ transaction }: Pick<IdentityDeps, 'transaction'>) =>
  (command: {
    steamId: string;
    displayName: string;
  }): Promise<Result<Player, 'invalid-steam-id'>> =>
    transaction.run(async ({ players }) => {
      const steamId = createSteamId(command.steamId);
      if (!steamId.ok) return steamId;

      const existing = await players.findById(playerIdOf(steamId.value));
      const player: Player = existing
        ? { ...existing, displayName: command.displayName }
        : registerPlayer({ steamId: steamId.value, displayName: command.displayName });

      await players.save(player);
      return ok(player);
    });

export const swearPlayerAllegiance =
  ({ transaction, clock }: IdentityDeps) =>
  (command: {
    playerId: PlayerId;
    faction: Faction;
  }): Promise<Result<Player, 'player-not-found' | AllegianceError>> =>
    transaction.run(async ({ players, outbox }) => {
      const player = await players.findById(command.playerId);
      if (player === null) return err('player-not-found');

      const oath = swearAllegiance(player, command.faction, clock.now());
      if (!oath.ok) return oath;

      await players.save(oath.value.player);
      if (oath.value.event) outbox.add(oath.value.event);
      return ok(oath.value.player);
    });
