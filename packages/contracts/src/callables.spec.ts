import { describe, expect, it } from 'vitest';
import {
  approveReportRequest,
  castVoteRequest,
  rejectReportRequest,
  submitReportRequest,
  swearAllegianceRequest,
} from './callables';

describe('castVoteRequest', () => {
  it('accepts a sector id', () => {
    expect(castVoteRequest.safeParse({ sectorId: 'steel-valley' }).success).toBe(true);
  });

  it('rejects a missing, empty or oversized sector id and unknown fields', () => {
    for (const data of [
      {},
      { sectorId: '' },
      { sectorId: 'x'.repeat(65) },
      { sectorId: 'a', x: 1 },
    ]) {
      expect(castVoteRequest.safeParse(data).success).toBe(false);
    }
  });
});

describe('swearAllegianceRequest', () => {
  it('accepts one of the three factions only', () => {
    expect(swearAllegianceRequest.safeParse({ faction: 'valkyra' }).success).toBe(true);
    expect(swearAllegianceRequest.safeParse({ faction: 'rebels' }).success).toBe(false);
  });
});

describe('submitReportRequest', () => {
  const valid = {
    placements: { first: 'valkyra', second: 'lonestar', third: 'manticore' },
    playedAt: '2026-10-01T20:00:00.000Z',
    screenshotPath: 'reports/steam:76561198000000001/shot.png',
  };

  it('accepts a report and turns playedAt into a Date', () => {
    const result = submitReportRequest.safeParse(valid);

    expect(result.success && result.data.playedAt).toEqual(new Date('2026-10-01T20:00:00.000Z'));
  });

  it('rejects an invalid date or an unknown faction', () => {
    expect(submitReportRequest.safeParse({ ...valid, playedAt: 'yesterday' }).success).toBe(false);
    expect(
      submitReportRequest.safeParse({
        ...valid,
        placements: { ...valid.placements, third: 'rebels' },
      }).success,
    ).toBe(false);
  });
});

describe('moderation requests', () => {
  it('approve needs a report id', () => {
    expect(approveReportRequest.safeParse({ reportId: 'r1' }).success).toBe(true);
    expect(approveReportRequest.safeParse({}).success).toBe(false);
  });

  it('reject needs a report id and a reason of at most 500 characters', () => {
    expect(rejectReportRequest.safeParse({ reportId: 'r1', reason: 'Blurry' }).success).toBe(true);
    expect(rejectReportRequest.safeParse({ reportId: 'r1' }).success).toBe(false);
    expect(rejectReportRequest.safeParse({ reportId: 'r1', reason: 'x'.repeat(501) }).success).toBe(
      false,
    );
  });
});
