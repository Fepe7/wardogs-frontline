import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../../config/game';
import type { FactionPlacements } from '../../shared/domain/faction';
import type { BattleId } from './battle';
import { rememberMatch, type RecentMatch } from './recent-matches';

const placements: FactionPlacements = { first: 'valkyra', second: 'lonestar', third: 'manticore' };

const match = (matchId: string, battleIds: string[] = []): RecentMatch => ({
  matchId,
  placements,
  playedAt: new Date('2026-10-01T20:00:00Z'),
  battleIds: battleIds.map((id) => id as BattleId),
});

describe('recent matches', () => {
  it('puts the newest counted match first', () => {
    const recent = rememberMatch([match('older')], match('newer'));

    expect(recent.map((m) => m.matchId)).toEqual(['newer', 'older']);
  });

  it('remembers which battles the match scored in', () => {
    const [latest] = rememberMatch([], match('m1', ['battle-1', 'battle-2']));

    expect(latest?.battleIds).toEqual(['battle-1', 'battle-2']);
  });

  it('keeps only the latest few, so the public document stays small', () => {
    const many = Array.from({ length: GAME_CONFIG.recentMatchesKept }, (_, i) =>
      match(`m${String(i)}`),
    );

    const recent = rememberMatch(many, match('newest'));

    expect(recent).toHaveLength(GAME_CONFIG.recentMatchesKept);
    expect(recent[0]?.matchId).toBe('newest');
    expect(recent.map((m) => m.matchId)).not.toContain(
      `m${String(GAME_CONFIG.recentMatchesKept - 1)}`,
    );
  });

  it('remembers a match once, even if the event is delivered again', () => {
    const once = rememberMatch([], match('m1'));

    expect(rememberMatch(once, match('m1'))).toBe(once);
  });
});
