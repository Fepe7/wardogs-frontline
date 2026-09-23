import { inject, Service } from '@angular/core';
import type {
  CallableErrorDetails,
  FastForwardDemoRequest,
  FastForwardDemoResponse,
} from '@frontline/contracts';
import { FirebaseClient } from '../../core/firebase/firebase';

export type FastForwardFailure = 'rate-limited' | 'failed';

/** Reason code the callables send in `details` (see CallableErrorDetails). */
export const failureOf = (error: unknown): FastForwardFailure => {
  const details = (error as { details?: Partial<CallableErrorDetails> } | null)?.details;
  return details?.reason === 'rate-limited' ? 'rate-limited' : 'failed';
};

/** Demo-only actions. */
@Service()
export class DemoControls {
  private readonly firebase = inject(FirebaseClient);

  /** Skips an hour of the shared demo war. The Functions SDK loads on the first press. */
  async fastForward(): Promise<FastForwardDemoResponse> {
    const [functions, { httpsCallable }] = await Promise.all([
      this.firebase.functions(),
      import('firebase/functions'),
    ]);
    const call = httpsCallable<FastForwardDemoRequest, FastForwardDemoResponse>(
      functions,
      'fastForwardDemo',
    );
    return (await call({})).data;
  }
}
