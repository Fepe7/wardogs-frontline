import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, Service } from '@angular/core';
import type { FirebaseApp } from 'firebase/app';
import type * as FirestoreSdk from 'firebase/firestore';
import type { Functions } from 'firebase/functions';
import { environment } from '../../../environments/environment';

/** Firestore plus its SDK functions, loaded together on first use. */
export interface FirestoreClient {
  readonly db: FirestoreSdk.Firestore;
  readonly sdk: typeof FirestoreSdk;
}

/**
 * Single entry point to the Firebase client SDK (AngularFire only supports Angular 20).
 * The client only reads: every write goes through callable functions.
 *
 * The SDK is imported on demand, not at startup: it is most of the app's weight, and
 * the first paint (rendered on the server) does not need it.
 */
@Service()
export class FirebaseClient {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private app: Promise<FirebaseApp> | undefined;
  private firestoreClient: Promise<FirestoreClient> | undefined;
  private callables: Promise<Functions> | undefined;

  /**
   * Null during the server render: a live listener would keep the render from ever
   * finishing. The browser subscribes after hydration.
   */
  firestore(): Promise<FirestoreClient> | null {
    if (!this.isBrowser) return null;
    this.firestoreClient ??= this.connectFirestore();
    return this.firestoreClient;
  }

  /** Callable functions: the only way the web writes. Called from user actions only. */
  functions(): Promise<Functions> {
    this.callables ??= this.connectFunctions();
    return this.callables;
  }

  private async connectFirestore(): Promise<FirestoreClient> {
    const [app, sdk] = await Promise.all([this.firebaseApp(), import('firebase/firestore')]);
    const db = sdk.getFirestore(app);
    const { emulators } = environment;
    if (emulators) sdk.connectFirestoreEmulator(db, emulators.host, emulators.firestorePort);
    return { db, sdk };
  }

  private async connectFunctions(): Promise<Functions> {
    const [app, sdk] = await Promise.all([this.firebaseApp(), import('firebase/functions')]);
    const callables = sdk.getFunctions(app, environment.functionsRegion);
    const { emulators } = environment;
    if (emulators) {
      sdk.connectFunctionsEmulator(callables, emulators.host, emulators.functionsPort);
    }
    return callables;
  }

  private firebaseApp(): Promise<FirebaseApp> {
    this.app ??= import('firebase/app').then(({ initializeApp }) =>
      initializeApp(environment.firebase),
    );
    return this.app;
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;

/** A Firestore Timestamp, recognised by shape so the SDK is not needed to check it. */
const isTimestamp = (value: unknown): value is { toDate(): Date } =>
  typeof value === 'object' &&
  value !== null &&
  'toDate' in value &&
  typeof value.toDate === 'function' &&
  'seconds' in value;

/** Firestore stores Timestamp; the domain uses Date. Converts recursively. */
export const fromFirestoreData = (value: unknown): unknown => {
  if (isTimestamp(value)) return value.toDate();
  if (Array.isArray(value)) return value.map(fromFirestoreData);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, field]) => [key, fromFirestoreData(field)]),
    );
  }
  return value;
};
