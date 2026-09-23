import type { Brand } from './brand';

/** Identity of a registered player (`steam:<steamId64>`). Owned by the identity context. */
export type PlayerId = Brand<string, 'PlayerId'>;
