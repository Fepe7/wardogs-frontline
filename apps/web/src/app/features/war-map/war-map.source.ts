import { inject, Service } from '@angular/core';
import { collection, doc, limit, onSnapshot, query, where } from 'firebase/firestore';
import type { OpenBattle, Sector } from '@frontline/core';
import { EMPTY, Observable } from 'rxjs';
import { FirebaseClient, fromFirestoreData } from '../../core/firebase/firebase';

/** firestore.rules only allows battle queries with a limit of at most 50. */
const MAX_OPEN_BATTLES = 50;

/**
 * Live reads of the war. The whole map is one document, so following it costs one
 * read per change (docs/ARQUITECTURA.md §5).
 */
@Service()
export class WarMapSource {
  private readonly firebase = inject(FirebaseClient);

  /** The sectors and their owners; null until the war starts. */
  watchMap(): Observable<readonly Sector[] | null> {
    const db = this.firebase.firestore();
    if (!db) return EMPTY;
    return new Observable((subscriber) =>
      onSnapshot(
        doc(db, 'war', 'map'),
        (snapshot) => {
          const data = fromFirestoreData(snapshot.data()) as { sectors: Sector[] } | undefined;
          subscriber.next(data?.sectors ?? null);
        },
        (error) => {
          subscriber.error(error);
        },
      ),
    );
  }

  watchOpenBattles(): Observable<readonly OpenBattle[]> {
    const db = this.firebase.firestore();
    if (!db) return EMPTY;
    const openBattles = query(
      collection(db, 'battles'),
      where('status', '==', 'open'),
      limit(MAX_OPEN_BATTLES),
    );
    return new Observable((subscriber) =>
      onSnapshot(
        openBattles,
        (snapshot) => {
          subscriber.next(snapshot.docs.map((d) => fromFirestoreData(d.data()) as OpenBattle));
        },
        (error) => {
          subscriber.error(error);
        },
      ),
    );
  }
}
