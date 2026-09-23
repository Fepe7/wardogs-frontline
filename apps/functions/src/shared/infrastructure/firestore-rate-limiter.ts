import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { Clock, PlayerId } from '@frontline/core';
import { COLLECTIONS } from './firestore-transaction';

export interface RateLimitRule {
  readonly action: string;
  readonly max: number;
  readonly windowMs: number;
}

export interface RateLimiter {
  /** Counts one use. Returns false, without counting, once the limit is reached. */
  consume(playerId: PlayerId, rule: RateLimitRule): Promise<boolean>;
}

/**
 * Fixed-window counter per player and action, in rateLimits/{action}_{player}_{window}.
 * Each document stores `expiresAt`, ready for a Firestore TTL policy to delete it.
 */
export const firestoreRateLimiter = (db: Firestore, clock: Clock): RateLimiter => ({
  consume: (playerId, rule) =>
    db.runTransaction(async (transaction) => {
      const windowStart = Math.floor(clock.now().getTime() / rule.windowMs) * rule.windowMs;
      const ref = db
        .collection(COLLECTIONS.rateLimits)
        .doc(`${rule.action}_${playerId}_${String(windowStart)}`);
      const snapshot = await transaction.get(ref);
      const count = snapshot.exists ? (snapshot.get('count') as number) : 0;
      if (count >= rule.max) return false;

      transaction.set(ref, {
        count: count + 1,
        expiresAt: Timestamp.fromMillis(windowStart + rule.windowMs),
      });
      return true;
    }),
});
