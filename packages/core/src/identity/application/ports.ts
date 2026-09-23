import type { EventOutbox } from '../../shared/application/ports';
import type { PlayerId } from '../../shared/domain/player-id';
import type { Player } from '../domain/player';

export interface PlayerRepository {
  findById(id: PlayerId): Promise<Player | null>;
  save(player: Player): Promise<void>;
}

/** What an identity use case can touch inside one transaction. */
export interface IdentityTransactionContext {
  readonly players: PlayerRepository;
  readonly outbox: EventOutbox;
}
