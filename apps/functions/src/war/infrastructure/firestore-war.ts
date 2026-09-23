import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type {
  Battle,
  BattleRepository,
  OpenBattle,
  OpenVoteRound,
  Sector,
  VoteRound,
  VoteRoundRepository,
  WarMapRepository,
  WarTransactionContext,
} from '@frontline/core';
import { fromDocument, toDocument } from '../../shared/infrastructure/document-mapping';
import { COLLECTIONS } from '../../shared/infrastructure/firestore-transaction';

const MAP_DOCUMENT = 'map';

/** The whole map lives in one document, so loading it costs a single read. */
class FirestoreWarMapRepository implements WarMapRepository {
  constructor(
    private readonly db: Firestore,
    private readonly transaction: Transaction,
  ) {}

  async load(): Promise<readonly Sector[] | null> {
    const snapshot = await this.transaction.get(this.document());
    return snapshot.exists
      ? (fromDocument(snapshot.data()) as { sectors: Sector[] }).sectors
      : null;
  }

  save(map: readonly Sector[]): Promise<void> {
    this.transaction.set(this.document(), toDocument({ sectors: map }));
    return Promise.resolve();
  }

  private document() {
    return this.db.collection(COLLECTIONS.war).doc(MAP_DOCUMENT);
  }
}

class FirestoreVoteRoundRepository implements VoteRoundRepository {
  constructor(
    private readonly db: Firestore,
    private readonly transaction: Transaction,
  ) {}

  async findOpen(): Promise<OpenVoteRound[]> {
    const query = this.collection().where('status', '==', 'open');
    const snapshot = await this.transaction.get(query);
    return snapshot.docs.map((doc) => fromDocument(doc.data()) as OpenVoteRound);
  }

  save(round: VoteRound): Promise<void> {
    this.transaction.set(this.collection().doc(round.id), toDocument(round));
    return Promise.resolve();
  }

  private collection() {
    return this.db.collection(COLLECTIONS.voteRounds);
  }
}

class FirestoreBattleRepository implements BattleRepository {
  constructor(
    private readonly db: Firestore,
    private readonly transaction: Transaction,
  ) {}

  async findOpen(): Promise<OpenBattle[]> {
    const query = this.collection().where('status', '==', 'open');
    const snapshot = await this.transaction.get(query);
    return snapshot.docs.map((doc) => fromDocument(doc.data()) as OpenBattle);
  }

  save(battle: Battle): Promise<void> {
    this.transaction.set(this.collection().doc(battle.id), toDocument(battle));
    return Promise.resolve();
  }

  private collection() {
    return this.db.collection(COLLECTIONS.battles);
  }
}

export const warContext =
  (db: Firestore) =>
  (transaction: Transaction): WarTransactionContext => ({
    map: new FirestoreWarMapRepository(db, transaction),
    rounds: new FirestoreVoteRoundRepository(db, transaction),
    battles: new FirestoreBattleRepository(db, transaction),
  });
