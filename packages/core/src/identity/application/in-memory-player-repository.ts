import type { PlayerId } from '../../shared/domain/player-id';
import type { Player } from '../domain/player';
import type { PlayerRepository } from './ports';

/** In-memory adapter for use case tests. */
export class InMemoryPlayerRepository implements PlayerRepository {
  private readonly players = new Map<PlayerId, Player>();

  findById(id: PlayerId): Promise<Player | null> {
    return Promise.resolve(this.players.get(id) ?? null);
  }

  save(player: Player): Promise<void> {
    this.players.set(player.id, player);
    return Promise.resolve();
  }

  all(): Player[] {
    return [...this.players.values()];
  }
}
