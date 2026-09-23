import { createHash } from 'node:crypto';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { Clock } from '@frontline/core';
import { COLLECTIONS } from '../../shared/infrastructure/firestore-transaction';

export interface SteamNonces {
  /** Marks the nonce as used. Returns false if it was already used (a replayed login). */
  claim(nonce: string): Promise<boolean>;
}

/** Longer than a login can live (see steam-openid.ts), so a replay always finds its nonce. */
const NONCE_RETENTION_MS = 60 * 60 * 1000;
const ALREADY_EXISTS = 6; // gRPC status code

/**
 * Single-use logins, in steamNonces/{sha256(nonce)}. `create` fails if the document
 * exists, which makes the check atomic. `expiresAt` is ready for a Firestore TTL policy.
 */
export const firestoreSteamNonces = (db: Firestore, clock: Clock): SteamNonces => ({
  claim: async (nonce) => {
    // Hashed because a nonce may contain characters that are not valid in a document id.
    const id = createHash('sha256').update(nonce).digest('hex');
    try {
      await db
        .collection(COLLECTIONS.steamNonces)
        .doc(id)
        .create({ expiresAt: Timestamp.fromMillis(clock.now().getTime() + NONCE_RETENTION_MS) });
      return true;
    } catch (error) {
      if ((error as { code?: unknown }).code === ALREADY_EXISTS) return false;
      throw error;
    }
  },
});
