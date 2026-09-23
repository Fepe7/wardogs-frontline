import type { Firestore } from 'firebase-admin/firestore';
import {
  advanceWar,
  approveMatchReport,
  castVoteInRound,
  rejectMatchReport,
  scoreApprovedMatch,
  signInPlayer,
  startWar,
  submitMatchReport,
  swearPlayerAllegiance,
  withdrawVoteOnAllegianceChange,
  type Clock,
} from '@frontline/core';
import { identityContext } from './identity/infrastructure/firestore-identity';
import { matchesContext } from './matches/infrastructure/firestore-matches';
import {
  firestoreIds,
  firestoreTransaction,
  systemClock,
} from './shared/infrastructure/firestore-transaction';
import { warContext } from './war/infrastructure/firestore-war';

/**
 * Composition root: the only place where use cases are wired to their Firestore
 * adapters. Handlers receive the result and never build dependencies themselves.
 */
export const composeUseCases = (db: Firestore, clock: Clock = systemClock) => {
  const ids = firestoreIds(db);
  const matches = { transaction: firestoreTransaction(db, matchesContext(db)), clock, ids };
  const identity = { transaction: firestoreTransaction(db, identityContext(db)), clock };
  const war = { transaction: firestoreTransaction(db, warContext(db)), clock, ids };

  return {
    submitMatchReport: submitMatchReport(matches),
    approveMatchReport: approveMatchReport(matches),
    rejectMatchReport: rejectMatchReport(matches),
    signInPlayer: signInPlayer(identity),
    swearPlayerAllegiance: swearPlayerAllegiance(identity),
    castVoteInRound: castVoteInRound(war),
    withdrawVoteOnAllegianceChange: withdrawVoteOnAllegianceChange(war),
    scoreApprovedMatch: scoreApprovedMatch(war),
    startWar: startWar(war),
    advanceWar: advanceWar(war),
  };
};

export type UseCases = ReturnType<typeof composeUseCases>;
