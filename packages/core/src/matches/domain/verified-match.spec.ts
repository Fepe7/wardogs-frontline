import { describe, expect, it } from 'vitest';
import type { FactionPlacements } from '../../shared/domain/faction';
import type { MatchReportId } from './match-report';
import { verifyMatch } from './verified-match';

const playedAt = new Date('2026-10-01T20:00:00Z');
const recordedAt = new Date('2026-10-01T20:05:00Z');
const placements: FactionPlacements = { first: 'valkyra', second: 'lonestar', third: 'manticore' };
const id = 'match-1' as MatchReportId;

describe('a match from a trusted source', () => {
  it('is approved right away, without moderation', () => {
    expect(verifyMatch({ id, placements, playedAt, recordedAt })).toEqual({
      ok: true,
      value: {
        type: 'MatchApproved',
        reportId: 'match-1',
        placements,
        playedAt,
        occurredAt: recordedAt,
      },
    });
  });

  it('still needs three different factions', () => {
    const result = verifyMatch({
      id,
      placements: { ...placements, third: 'valkyra' },
      playedAt,
      recordedAt,
    });

    expect(result).toEqual({ ok: false, error: 'duplicate-faction' });
  });

  it('cannot have been played after it was recorded', () => {
    const result = verifyMatch({ id, placements, playedAt: recordedAt, recordedAt: playedAt });

    expect(result).toEqual({ ok: false, error: 'played-in-future' });
  });
});
