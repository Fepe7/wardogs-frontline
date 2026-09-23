import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type {
  EventOutbox,
  IdentityTransactionContext,
  Player,
  PlayerId,
  PlayerRepository,
} from '@frontline/core';
import { fromDocument, toDocument } from '../../shared/infrastructure/document-mapping';
import { COLLECTIONS } from '../../shared/infrastructure/firestore-transaction';

class FirestorePlayerRepository implements PlayerRepository {
  constructor(
    private readonly db: Firestore,
    private readonly transaction: Transaction,
  ) {}

  async findById(id: PlayerId): Promise<Player | null> {
    const snapshot = await this.transaction.get(this.document(id));
    return snapshot.exists ? (fromDocument(snapshot.data()) as Player) : null;
  }

  save(player: Player): Promise<void> {
    this.transaction.set(this.document(player.id), toDocument(player));
    return Promise.resolve();
  }

  private document(id: PlayerId) {
    return this.db.collection(COLLECTIONS.players).doc(id);
  }
}

export const identityContext =
  (db: Firestore) =>
  (transaction: Transaction, outbox: EventOutbox): IdentityTransactionContext => ({
    players: new FirestorePlayerRepository(db, transaction),
    outbox,
  });
