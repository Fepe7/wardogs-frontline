import { describe, expect, it } from 'vitest';
import type { FactionPlacements } from '../../shared/domain/faction';
import type { PlayerId } from '../../shared/domain/player-id';
import {
  approveReport,
  rejectReport,
  submitManualReport,
  type MatchReportId,
  type PendingReport,
} from './match-report';

const playedAt = new Date('2026-10-01T20:00:00Z');
const reportedAt = new Date('2026-10-01T20:30:00Z');
const decidedAt = new Date('2026-10-01T21:00:00Z');

const reporter = 'steam:111' as PlayerId;
const moderator = 'steam:999' as PlayerId;
const placements: FactionPlacements = { first: 'valkyra', second: 'lonestar', third: 'manticore' };

const submit = (overrides: Partial<Parameters<typeof submitManualReport>[0]> = {}) =>
  submitManualReport({
    id: 'report-1' as MatchReportId,
    placements,
    playedAt,
    reportedBy: reporter,
    reportedAt,
    screenshotPath: 'reports/steam:111/report-1.png',
    ...overrides,
  });

const pending = (): PendingReport => {
  const result = submit();
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

describe('submitManualReport', () => {
  it('creates a pending report backed by a screenshot', () => {
    expect(submit()).toEqual({
      ok: true,
      value: {
        status: 'pending',
        id: 'report-1',
        placements,
        playedAt,
        reportedBy: reporter,
        reportedAt,
        source: { kind: 'manual', screenshotPath: 'reports/steam:111/report-1.png' },
      },
    });
  });

  it('rejects a ranking where a faction appears twice', () => {
    const result = submit({
      placements: { first: 'valkyra', second: 'valkyra', third: 'lonestar' },
    });

    expect(result).toEqual({ ok: false, error: 'duplicate-faction' });
  });

  it('rejects a match played after it was reported', () => {
    expect(submit({ playedAt: new Date('2026-10-01T21:00:00Z') })).toEqual({
      ok: false,
      error: 'played-in-future',
    });
  });

  it('requires a screenshot', () => {
    expect(submit({ screenshotPath: '' })).toEqual({ ok: false, error: 'missing-screenshot' });
  });
});

describe('approveReport', () => {
  it('approves the report and emits MatchApproved for the war to score it', () => {
    const result = approveReport(pending(), { moderatorId: moderator, decidedAt });
    if (!result.ok) throw new Error(result.error);

    expect(result.value.report).toMatchObject({
      status: 'approved',
      moderation: { moderatorId: moderator, decidedAt },
    });
    expect(result.value.event).toEqual({
      type: 'MatchApproved',
      reportId: 'report-1',
      placements,
      playedAt,
      occurredAt: decidedAt,
    });
  });

  it('does not let a moderator approve their own report', () => {
    expect(approveReport(pending(), { moderatorId: reporter, decidedAt })).toEqual({
      ok: false,
      error: 'self-moderation',
    });
  });
});

describe('rejectReport', () => {
  it('rejects the report and keeps the reason', () => {
    const result = rejectReport(pending(), {
      moderatorId: moderator,
      decidedAt,
      reason: 'Scoreboard does not match the placements',
    });

    expect(result.ok && result.value).toMatchObject({
      status: 'rejected',
      moderation: {
        moderatorId: moderator,
        decidedAt,
        reason: 'Scoreboard does not match the placements',
      },
    });
  });

  it('requires a reason', () => {
    expect(rejectReport(pending(), { moderatorId: moderator, decidedAt, reason: '   ' })).toEqual({
      ok: false,
      error: 'missing-reason',
    });
  });

  it('does not let a moderator reject their own report', () => {
    expect(
      rejectReport(pending(), { moderatorId: reporter, decidedAt, reason: 'Wrong screenshot' }),
    ).toEqual({ ok: false, error: 'self-moderation' });
  });
});
