import { beforeEach, describe, expect, it } from 'vitest';
import {
  fixedClock,
  inMemoryTransaction,
  InMemoryOutbox,
  sequentialIds,
} from '../../shared/application/testing';
import type { FactionPlacements } from '../../shared/domain/faction';
import type { PlayerId } from '../../shared/domain/player-id';
import type { MatchReportId } from '../domain/match-report';
import { InMemoryMatchReportRepository } from './in-memory-match-report-repository';
import {
  approveMatchReport,
  recordVerifiedMatch,
  rejectMatchReport,
  submitMatchReport,
} from './match-report-use-cases';

const now = new Date('2026-10-01T21:00:00Z');
const playedAt = new Date('2026-10-01T20:00:00Z');
const reporter = 'steam:111' as PlayerId;
const moderator = 'steam:999' as PlayerId;
const placements: FactionPlacements = { first: 'valkyra', second: 'lonestar', third: 'manticore' };

let reports: InMemoryMatchReportRepository;
let outbox: InMemoryOutbox;
let deps: Parameters<typeof submitMatchReport>[0];

beforeEach(() => {
  reports = new InMemoryMatchReportRepository();
  outbox = new InMemoryOutbox();
  deps = {
    transaction: inMemoryTransaction({ reports, outbox }),
    clock: fixedClock(now),
    ids: sequentialIds('report'),
  };
});

const submitted = async (): Promise<MatchReportId> => {
  const result = await submitMatchReport(deps)({
    reportedBy: reporter,
    placements,
    playedAt,
    screenshotPath: 'reports/steam:111/shot.png',
  });
  if (!result.ok) throw new Error(result.error);
  return result.value.id;
};

describe('submitMatchReport', () => {
  it('stores a pending report with a generated id and the current time', async () => {
    const id = await submitted();

    expect(await reports.findById(id)).toMatchObject({
      id: 'report-1',
      status: 'pending',
      reportedBy: reporter,
      reportedAt: now,
    });
  });

  it('stores nothing when the report is invalid', async () => {
    const result = await submitMatchReport(deps)({
      reportedBy: reporter,
      placements: { first: 'valkyra', second: 'valkyra', third: 'lonestar' },
      playedAt,
      screenshotPath: 'reports/steam:111/shot.png',
    });

    expect(result).toEqual({ ok: false, error: 'duplicate-faction' });
    expect(reports.all()).toEqual([]);
  });
});

describe('approveMatchReport', () => {
  it('approves the report and adds MatchApproved to the outbox', async () => {
    const reportId = await submitted();

    const result = await approveMatchReport(deps)({ reportId, moderatorId: moderator });

    expect(result.ok).toBe(true);
    expect((await reports.findById(reportId))?.status).toBe('approved');
    expect(outbox.events).toEqual([
      { type: 'MatchApproved', reportId, placements, playedAt, occurredAt: now },
    ]);
  });

  it('fails for an unknown report', async () => {
    const result = await approveMatchReport(deps)({
      reportId: 'nope' as MatchReportId,
      moderatorId: moderator,
    });

    expect(result).toEqual({ ok: false, error: 'report-not-found' });
  });

  it('cannot approve a report twice, and emits a single event', async () => {
    const reportId = await submitted();
    await approveMatchReport(deps)({ reportId, moderatorId: moderator });

    const second = await approveMatchReport(deps)({ reportId, moderatorId: moderator });

    expect(second).toEqual({ ok: false, error: 'report-not-pending' });
    expect(outbox.events).toHaveLength(1);
  });

  it('writes nothing when the moderator is the reporter', async () => {
    const reportId = await submitted();

    const result = await approveMatchReport(deps)({ reportId, moderatorId: reporter });

    expect(result).toEqual({ ok: false, error: 'self-moderation' });
    expect((await reports.findById(reportId))?.status).toBe('pending');
    expect(outbox.events).toEqual([]);
  });
});

describe('rejectMatchReport', () => {
  it('rejects the report with its reason and emits no event', async () => {
    const reportId = await submitted();

    const result = await rejectMatchReport(deps)({
      reportId,
      moderatorId: moderator,
      reason: 'Blurry screenshot',
    });

    expect(result.ok).toBe(true);
    expect(await reports.findById(reportId)).toMatchObject({
      status: 'rejected',
      moderation: { reason: 'Blurry screenshot' },
    });
    expect(outbox.events).toEqual([]);
  });

  it('fails for an unknown report', async () => {
    const result = await rejectMatchReport(deps)({
      reportId: 'nope' as MatchReportId,
      moderatorId: moderator,
      reason: 'Blurry screenshot',
    });

    expect(result).toEqual({ ok: false, error: 'report-not-found' });
  });

  it('cannot reject an already moderated report', async () => {
    const reportId = await submitted();
    await approveMatchReport(deps)({ reportId, moderatorId: moderator });

    const result = await rejectMatchReport(deps)({
      reportId,
      moderatorId: moderator,
      reason: 'Changed my mind',
    });

    expect(result).toEqual({ ok: false, error: 'report-not-pending' });
  });

  it('propagates domain errors without writing', async () => {
    const reportId = await submitted();

    const result = await rejectMatchReport(deps)({ reportId, moderatorId: moderator, reason: '' });

    expect(result).toEqual({ ok: false, error: 'missing-reason' });
    expect((await reports.findById(reportId))?.status).toBe('pending');
  });
});

describe('recordVerifiedMatch', () => {
  it('approves the match right away, so the war scores it', async () => {
    const result = await recordVerifiedMatch(deps)({ placements, playedAt });

    expect(result.ok).toBe(true);
    expect(outbox.events).toEqual([
      { type: 'MatchApproved', reportId: 'report-1', placements, playedAt, occurredAt: now },
    ]);
  });

  it('records nothing when the result is invalid', async () => {
    const result = await recordVerifiedMatch(deps)({
      placements: { ...placements, second: 'valkyra' },
      playedAt,
    });

    expect(result).toEqual({ ok: false, error: 'duplicate-faction' });
    expect(outbox.events).toEqual([]);
  });
});
