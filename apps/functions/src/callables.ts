import type { Firestore } from 'firebase-admin/firestore';
import {
  approveReportRequest,
  castVoteRequest,
  rejectReportRequest,
  submitReportRequest,
  swearAllegianceRequest,
} from '@frontline/contracts';
import { err, ok, type MatchReportId, type SectorId } from '@frontline/core';
import type { UseCases } from './composition';
import { readPlayer } from './identity/infrastructure/firestore-identity';
import { defineCallable } from './shared/handlers/callable';
import type { RateLimiter, RateLimitRule } from './shared/infrastructure/firestore-rate-limiter';

const HOUR_MS = 60 * 60 * 1000;

/** Anti-abuse limits per player (docs/DISEÑO.md §5). */
export const RATE_LIMITS: Readonly<
  Record<'submitReport' | 'castVote' | 'fastForwardDemo', RateLimitRule>
> = {
  submitReport: { action: 'submitReport', max: 10, windowMs: 24 * HOUR_MS },
  castVote: { action: 'castVote', max: 30, windowMs: HOUR_MS },
  /** Global, not per player: anyone watching the demo can press the button. */
  fastForwardDemo: { action: 'fastForwardDemo', max: 20, windowMs: HOUR_MS },
};

/** Screenshots must live in the caller's own folder; storage.rules will enforce the same path when uploads open. */
const ownsScreenshot = (playerId: string, path: string): boolean =>
  path.startsWith(`reports/${playerId}/`) && !path.includes('..');

export const createCallables = (
  db: Firestore,
  useCases: UseCases,
  rateLimiter: RateLimiter,
  limits: typeof RATE_LIMITS = RATE_LIMITS,
) => ({
  swearAllegiance: defineCallable(
    {
      schema: swearAllegianceRequest,
      run: async (caller, { faction }) => {
        const result = await useCases.swearPlayerAllegiance({ playerId: caller.playerId, faction });
        return result.ok ? ok({ faction }) : result;
      },
    },
    rateLimiter,
  ),

  castVote: defineCallable(
    {
      schema: castVoteRequest,
      rateLimit: limits.castVote,
      run: async (caller, { sectorId }) => {
        // The faction is read from the player document, not from token claims, so a
        // faction change applies immediately instead of when the token refreshes.
        const player = await readPlayer(db, caller.playerId);
        if (player === null) return err('player-not-found');
        if (player.allegiance === null) return err('no-allegiance');

        const result = await useCases.castVoteInRound({
          playerId: caller.playerId,
          voterFaction: player.allegiance.faction,
          sectorId: sectorId as SectorId,
        });
        return result.ok ? ok({ sectorId }) : result;
      },
    },
    rateLimiter,
  ),

  submitReport: defineCallable(
    {
      schema: submitReportRequest,
      rateLimit: limits.submitReport,
      run: async (caller, data) => {
        if (!ownsScreenshot(caller.playerId, data.screenshotPath)) {
          return err('invalid-screenshot-path');
        }
        const result = await useCases.submitMatchReport({ ...data, reportedBy: caller.playerId });
        return result.ok ? ok({ reportId: result.value.id }) : result;
      },
    },
    rateLimiter,
  ),

  approveReport: defineCallable(
    {
      schema: approveReportRequest,
      moderatorOnly: true,
      run: async (caller, { reportId }) => {
        const result = await useCases.approveMatchReport({
          reportId: reportId as MatchReportId,
          moderatorId: caller.playerId,
        });
        return result.ok ? ok({ reportId, status: 'approved' as const }) : result;
      },
    },
    rateLimiter,
  ),

  rejectReport: defineCallable(
    {
      schema: rejectReportRequest,
      moderatorOnly: true,
      run: async (caller, { reportId, reason }) => {
        const result = await useCases.rejectMatchReport({
          reportId: reportId as MatchReportId,
          moderatorId: caller.playerId,
          reason,
        });
        return result.ok ? ok({ reportId, status: 'rejected' as const }) : result;
      },
    },
    rateLimiter,
  ),
});
