// Shared kernel
export type { Brand } from './shared/domain/brand';
export * from './shared/domain/faction';
export type { AllegianceChanged, MatchApproved } from './shared/domain/integration-events';
export type { PlayerId } from './shared/domain/player-id';
export * from './shared/domain/result';
export { GAME_CONFIG } from './config/game';
export type * from './shared/application/ports';

// War context
export * from './war/domain/battle';
export * from './war/domain/hex-coord';
export * from './war/domain/match-points';
export * from './war/domain/vote-round';
export * from './war/domain/war-map';

// Matches context
export * from './matches/domain/match-report';
export type * from './matches/application/ports';
export * from './matches/application/match-report-use-cases';

// Identity context
export * from './identity/domain/player';
export * from './identity/domain/steam-id';
export type * from './identity/application/ports';
export * from './identity/application/player-use-cases';
