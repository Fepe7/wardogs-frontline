import { inject, Service } from '@angular/core';
import type { DocumentSnapshot, Query, QuerySnapshot } from 'firebase/firestore';
import type { OpenBattle, RecentMatch, Sector } from '@frontline/core';
import { defer, EMPTY, Observable, switchMap } from 'rxjs';
import {
  FirebaseClient,
  fromFirestoreData,
  type FirestoreClient,
} from '../../core/firebase/firebase';

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
    return this.watchDocument(['war', 'map'], (snapshot, next) => {
      // An empty answer from the local cache only means the server has not replied
      // yet, not that the war has not started.
      if (snapshot.metadata.fromCache && !snapshot.exists()) return;
      const data = fromFirestoreData(snapshot.data()) as { sectors: Sector[] } | undefined;
      next(data?.sectors ?? null);
    });
  }

  /**
   * Demo only: how far the demo clock runs ahead of real time (the fast-forward button
   * moves it). War times minus this offset are real times.
   */
  watchDemoOffset(): Observable<number> {
    return this.watchDocument(['demo', 'clock'], (snapshot, next) => {
      const offset: unknown = snapshot.get('offsetMs');
      next(typeof offset === 'number' ? offset : 0);
    });
  }

  /** The latest matches the war has counted, newest first (one public document). */
  watchRecentMatches(): Observable<readonly RecentMatch[]> {
    return this.watchDocument(['war', 'recentMatches'], (snapshot, next) => {
      const data = fromFirestoreData(snapshot.data()) as { matches: RecentMatch[] } | undefined;
      next(data?.matches ?? []);
    });
  }

  watchOpenBattles(): Observable<readonly OpenBattle[]> {
    return this.withFirestore(({ db, sdk }) => {
      const openBattles: Query = sdk.query(
        sdk.collection(db, 'battles'),
        sdk.where('status', '==', 'open'),
        sdk.limit(MAX_OPEN_BATTLES),
      );
      return new Observable<readonly OpenBattle[]>((subscriber) =>
        sdk.onSnapshot(
          openBattles,
          (snapshot: QuerySnapshot) => {
            subscriber.next(snapshot.docs.map((d) => fromFirestoreData(d.data()) as OpenBattle));
          },
          (error) => {
            subscriber.error(error);
          },
        ),
      );
    });
  }

  private watchDocument<T>(
    [collection, id]: readonly [string, string],
    handle: (snapshot: DocumentSnapshot, next: (value: T) => void) => void,
  ): Observable<T> {
    return this.withFirestore(
      ({ db, sdk }) =>
        new Observable<T>((subscriber) =>
          sdk.onSnapshot(
            sdk.doc(db, collection, id),
            (snapshot) => {
              handle(snapshot, (value) => {
                subscriber.next(value);
              });
            },
            (error) => {
              subscriber.error(error);
            },
          ),
        ),
    );
  }

  /** Waits for the SDK to load (browser only) before opening the listener. */
  private withFirestore<T>(open: (client: FirestoreClient) => Observable<T>): Observable<T> {
    return defer(() => this.firebase.firestore() ?? Promise.resolve(null)).pipe(
      switchMap((client) => (client ? open(client) : EMPTY)),
    );
  }
}
