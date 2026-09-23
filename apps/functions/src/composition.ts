import type { Firestore } from 'firebase-admin/firestore';
import {
  advanceWar,
  approveMatchReport,
  castVoteInRound,
  GAME_CONFIG,
  recordVerifiedMatch,
  rejectMatchReport,
  scoreApprovedMatch,
  signInPlayer,
  startWar,
  submitMatchReport,
  swearPlayerAllegiance,
  withdrawVoteOnAllegianceChange,
  type Clock,
  type WarPace,
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
export const composeUseCases = (
  db: Firestore,
  clock: Clock = systemClock,
  pace: WarPace = GAME_CONFIG.pace.standard,
) => {
  const ids = firestoreIds(db);
  const matches = { transaction: firestoreTransaction(db, matchesContext(db)), clock, ids };
  const identity = { transaction: firestoreTransaction(db, identityContext(db)), clock };
  const war = { transaction: firestoreTransaction(db, warContext(db)), clock, ids, pace };

  return {
    submitMatchReport: submitMatchReport(matches),
    approveMatchReport: approveMatchReport(matches),
    rejectMatchReport: rejectMatchReport(matches),
    recordVerifiedMatch: recordVerifiedMatch(matches),
    signInPlayer: signInPlayer(identity),
    swearPlayerAllegiance: swearPlayerAllegiance(identity),
    castVoteInRound: castVoteInRound(war),
    withdrawVoteOnAllegianceChange: withdrawVoteOnAllegianceChange(war),
    scoreApprovedMatch: scoreApprovedMatch(war),
    startWar: startWar(war),
    advanceWar: advanceWar(war),
    /** Read-only snapshot of the war, for the dev simulator. */
    readWar: () =>
      war.transaction.run(async ({ map, rounds, battles }) => ({
        sectors: await map.load(),
        openRounds: await rounds.findOpen(),
        openBattles: await battles.findOpen(),
      })),
  };
};

export type UseCases = ReturnType<typeof composeUseCases>;
