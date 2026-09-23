import {
  HttpsError,
  type CallableRequest,
  type FunctionsErrorCode,
} from 'firebase-functions/v2/https';
import type { PlayerId, Result } from '@frontline/core';
import type { CallableErrorDetails } from '@frontline/contracts';
import type { z } from 'zod';
import type { RateLimiter, RateLimitRule } from '../infrastructure/firestore-rate-limiter';

/** The verified caller. The uid is the player id (`steam:<steamId64>`, see identity). */
export interface Caller {
  readonly playerId: PlayerId;
  readonly isModerator: boolean;
}

/** What a callable handler needs from the request, so it can be tested without HTTP. */
export interface CallableInput {
  readonly auth?: CallableRequest['auth'];
  readonly data: unknown;
}

const fail = (code: FunctionsErrorCode, reason: string): never => {
  const details: CallableErrorDetails = { reason };
  throw new HttpsError(code, reason, details);
};

/** Expected domain errors become typed HttpsErrors; `reason` is what the web app translates. */
const httpsCodeFor = (reason: string): FunctionsErrorCode => {
  if (reason.endsWith('-not-found')) return 'not-found';
  if (reason === 'self-moderation') return 'permission-denied';
  return 'failed-precondition';
};

/**
 * Every callable goes through the same checks, in this order (docs/ARQUITECTURA.md §7):
 * App Check (enforced by onCall) → authentication → Zod → authorization → rate limit →
 * use case. Each callable is a public endpoint, so nothing from the client is trusted.
 */
export const defineCallable =
  <Schema extends z.ZodType, Output>(
    spec: {
      readonly schema: Schema;
      readonly moderatorOnly?: boolean;
      readonly rateLimit?: RateLimitRule;
      readonly run: (caller: Caller, data: z.output<Schema>) => Promise<Result<Output, string>>;
    },
    rateLimiter: RateLimiter,
  ) =>
  async (request: CallableInput): Promise<Output> => {
    const auth = request.auth ?? fail('unauthenticated', 'unauthenticated');

    const parsed = spec.schema.safeParse(request.data);
    if (!parsed.success) return fail('invalid-argument', 'invalid-request');

    const caller: Caller = {
      playerId: auth.uid as PlayerId,
      isModerator: auth.token['moderator'] === true,
    };
    if (spec.moderatorOnly && !caller.isModerator) {
      return fail('permission-denied', 'moderator-only');
    }

    if (spec.rateLimit && !(await rateLimiter.consume(caller.playerId, spec.rateLimit))) {
      return fail('resource-exhausted', 'rate-limited');
    }

    const result = await spec.run(caller, parsed.data);
    if (!result.ok) return fail(httpsCodeFor(result.error), result.error);
    return result.value;
  };
