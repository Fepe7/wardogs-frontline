import { FACTIONS } from '@frontline/core';
import { z } from 'zod';

/**
 * Request schemas of the callable functions. The server validates every request with
 * them; the web app uses the inferred types to call the functions. Objects are strict,
 * so unknown fields are rejected.
 */

const id = z.string().min(1).max(64);
const faction = z.enum(FACTIONS);

export const castVoteRequest = z.strictObject({ sectorId: id });
export type CastVoteRequest = z.infer<typeof castVoteRequest>;

export const swearAllegianceRequest = z.strictObject({ faction });
export type SwearAllegianceRequest = z.infer<typeof swearAllegianceRequest>;

export const submitReportRequest = z.strictObject({
  placements: z.strictObject({ first: faction, second: faction, third: faction }),
  /** ISO 8601 over the wire, a Date once parsed. */
  playedAt: z.iso.datetime().transform((value) => new Date(value)),
  screenshotPath: z.string().min(1).max(256),
});
export type SubmitReportRequest = z.input<typeof submitReportRequest>;

export const approveReportRequest = z.strictObject({ reportId: id });
export type ApproveReportRequest = z.infer<typeof approveReportRequest>;

export const rejectReportRequest = z.strictObject({
  reportId: id,
  reason: z.string().min(1).max(500),
});
export type RejectReportRequest = z.infer<typeof rejectReportRequest>;

/** Error payload sent by every callable: `reason` is a stable code the web app translates. */
export interface CallableErrorDetails {
  readonly reason: string;
}
