import type { Firestore } from 'firebase-admin/firestore';
import { fastForwardDemoRequest, type FastForwardDemoResponse } from '@frontline/contracts';
import type { Clock, PlayerId, WarPace } from '@frontline/core';
import { composeUseCases } from '../composition';
import { dispatchPendingEvents } from '../events/dispatch-event';
import { fail, type CallableInput } from '../shared/handlers/callable';
import type { RateLimiter, RateLimitRule } from '../shared/infrastructure/firestore-rate-limiter';
import { advanceDemoClock, shiftedClock } from './demo-clock';
import { simulateWar } from './simulate-war';

const MINUTE_MS = 60 * 1000;
/** One press of the button skips this much war time... */
export const FAST_FORWARD_MINUTES = 60;
/** ...replayed in steps as frequent as the simulator job (every 10 minutes). */
const STEP_MINUTES = 10;

/**
 * Skips an hour of the demo war in a few seconds. It moves the demo clock ahead first
 * (so the scheduled jobs never run behind it) and then replays that hour step by step:
 * battles and vote rounds that end are closed, bots vote, and one simulated match is
 * played and scored per step, exactly as the jobs would have done.
 */
export const fastForwardDemo =
  (deps: { db: Firestore; clock: Clock; pace: WarPace; random: () => number }) =>
  async (): Promise<FastForwardDemoResponse> => {
    const { db, pace, random } = deps;
    const startOffset = await advanceDemoClock(db, FAST_FORWARD_MINUTES * MINUTE_MS);

    let resolvedBattles = 0;
    let closedRounds = 0;
    let matches = 0;
    for (let minutes = STEP_MINUTES; minutes <= FAST_FORWARD_MINUTES; minutes += STEP_MINUTES) {
      const clock = shiftedClock(deps.clock, startOffset + minutes * MINUTE_MS);
      const useCases = composeUseCases(db, clock, pace);

      const advanced = await useCases.advanceWar();
      const simulated = await simulateWar({ ...useCases, clock, random })();
      // Score the match now: a battle may end in the next step, before any trigger runs.
      await dispatchPendingEvents(db, useCases);

      resolvedBattles += advanced.resolvedBattles;
      closedRounds += advanced.closedRounds;
      matches += simulated.matches;
    }
    return { resolvedBattles, closedRounds, matches };
  };

/**
 * Callable wrapper. Anyone looking at the demo may press the button, signed in or not,
 * so the limit is global: App Check (enforced by onCall) → Zod → demo only → rate limit.
 */
export const fastForwardDemoCallable =
  (deps: {
    demoMode: boolean;
    rateLimiter: RateLimiter;
    rateLimit: RateLimitRule;
    run: () => Promise<FastForwardDemoResponse>;
  }) =>
  async (request: CallableInput): Promise<FastForwardDemoResponse> => {
    if (!fastForwardDemoRequest.safeParse(request.data).success) {
      return fail('invalid-argument', 'invalid-request');
    }
    if (!deps.demoMode) return fail('failed-precondition', 'demo-only');
    if (!(await deps.rateLimiter.consume('demo' as PlayerId, deps.rateLimit))) {
      return fail('resource-exhausted', 'rate-limited');
    }
    return deps.run();
  };
