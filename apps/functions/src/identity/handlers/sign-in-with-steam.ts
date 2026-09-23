import { signInWithSteamRequest, type SignInWithSteamResponse } from '@frontline/contracts';
import type { UseCases } from '../../composition';
import { fail, type CallableInput } from '../../shared/handlers/callable';
import type { SteamNonces } from '../infrastructure/firestore-steam-nonces';
import type { SteamOpenIdVerifier } from '../infrastructure/steam-openid';
import type { SteamProfiles } from '../infrastructure/steam-profiles';

export interface SignInWithSteamDeps {
  readonly verifier: SteamOpenIdVerifier;
  readonly nonces: SteamNonces;
  readonly profiles: SteamProfiles;
  readonly signInPlayer: UseCases['signInPlayer'];
  /** Firebase Auth custom token for the player id (`steam:<steamId64>`). */
  readonly createToken: (uid: string) => Promise<string>;
}

/**
 * Exchanges a Steam OpenID login for a Firebase custom token. It is the only callable
 * without authentication (it is how a player gets authenticated), so it trusts nothing
 * from the client: App Check (enforced by onCall) → Zod → Steam verifies the signature →
 * the login is single-use → register or update the player → token.
 */
export const signInWithSteam =
  (deps: SignInWithSteamDeps) =>
  async (request: CallableInput): Promise<SignInWithSteamResponse> => {
    const parsed = signInWithSteamRequest.safeParse(request.data);
    if (!parsed.success) return fail('invalid-argument', 'invalid-request');

    const login = await deps.verifier.verify(parsed.data.assertion);
    if (!login.ok) return failSteam(login.error);
    if (!(await deps.nonces.claim(login.value.nonce))) {
      return fail('unauthenticated', 'invalid-steam-assertion');
    }

    const displayName = await deps.profiles.displayNameOf(login.value.steamId);
    if (!displayName.ok) return failSteam(displayName.error);

    const player = await deps.signInPlayer({
      steamId: login.value.steamId,
      displayName: displayName.value,
    });
    if (!player.ok) return fail('unauthenticated', 'invalid-steam-assertion');

    return { token: await deps.createToken(player.value.id) };
  };

const failSteam = (reason: 'invalid-steam-assertion' | 'steam-unavailable'): never =>
  reason === 'steam-unavailable' ? fail('unavailable', reason) : fail('unauthenticated', reason);
