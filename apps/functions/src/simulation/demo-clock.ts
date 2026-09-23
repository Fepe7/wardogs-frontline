import type { Firestore } from 'firebase-admin/firestore';
import type { Clock } from '@frontline/core';
import { COLLECTIONS } from '../shared/infrastructure/firestore-transaction';

/**
 * The demo runs on its own clock: real time plus an offset that the fast-forward
 * button moves ahead. Stored in demo/clock, which the web reads to show real times.
 */
const clockDocument = (db: Firestore) => db.collection(COLLECTIONS.demo).doc('clock');

const offsetIn = (data: unknown): number => {
  const offset = (data as { offsetMs?: unknown } | undefined)?.offsetMs;
  return typeof offset === 'number' ? offset : 0;
};

export const readDemoOffset = async (db: Firestore): Promise<number> =>
  offsetIn((await clockDocument(db).get()).data());

export const shiftedClock = (base: Clock, offsetMs: number): Clock => ({
  now: () => new Date(base.now().getTime() + offsetMs),
});

/** Moves the demo clock forward atomically. Returns the offset it had before the jump. */
export const advanceDemoClock = (db: Firestore, byMs: number): Promise<number> =>
  db.runTransaction(async (transaction) => {
    const ref = clockDocument(db);
    const previous = offsetIn((await transaction.get(ref)).data());
    transaction.set(ref, { offsetMs: previous + byMs });
    return previous;
  });
