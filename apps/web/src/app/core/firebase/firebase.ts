import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, Service } from '@angular/core';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  getFirestore,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { environment } from '../../../environments/environment';

/**
 * Single entry point to the Firebase client SDK (AngularFire only supports Angular 20).
 * The client only reads: every write goes through callable functions.
 */
@Service()
export class FirebaseClient {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private app: FirebaseApp | undefined;
  private db: Firestore | undefined;

  /**
   * Null during the server render: a live listener would keep the render from ever
   * finishing. The browser subscribes after hydration.
   */
  firestore(): Firestore | null {
    if (!this.isBrowser) return null;
    if (this.db) return this.db;

    this.app ??= initializeApp(environment.firebase);
    this.db = getFirestore(this.app);
    const { emulators } = environment;
    if (emulators) connectFirestoreEmulator(this.db, emulators.host, emulators.firestorePort);
    return this.db;
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;

/** Firestore stores Timestamp; the domain uses Date. Converts recursively. */
export const fromFirestoreData = (value: unknown): unknown => {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(fromFirestoreData);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, field]) => [key, fromFirestoreData(field)]),
    );
  }
  return value;
};
