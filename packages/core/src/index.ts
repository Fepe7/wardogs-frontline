// Shared kernel
export type { Brand } from './shared/domain/brand';
export * from './shared/domain/faction';
export type { PlayerId } from './shared/domain/player-id';
export * from './shared/domain/result';
export { GAME_CONFIG } from './config/game';

// War context
export * from './war/domain/battle';
export * from './war/domain/hex-coord';
export * from './war/domain/match-points';
export * from './war/domain/vote-round';
export * from './war/domain/war-map';
