import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, Service } from '@angular/core';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
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
  private callables: Functions | undefined;

  /**
   * Null during the server render: a live listener would keep the render from ever
   * finishing. The browser subscribes after hydration.
   */
  firestore(): Firestore | null {
    if (!this.isBrowser) return null;
    if (this.db) return this.db;

    this.db = getFirestore(this.firebaseApp());
    const { emulators } = environment;
    if (emulators) connectFirestoreEmulator(this.db, emulators.host, emulators.firestorePort);
    return this.db;
  }

  /** Callable functions: the only way the web writes. Called from user actions only. */
  functions(): Functions {
    if (this.callables) return this.callables;
    this.callables = getFunctions(this.firebaseApp(), environment.functionsRegion);
    const { emulators } = environment;
    if (emulators)
      connectFunctionsEmulator(this.callables, emulators.host, emulators.functionsPort);
    return this.callables;
  }

  private firebaseApp(): FirebaseApp {
    this.app ??= initializeApp(environment.firebase);
    return this.app;
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
