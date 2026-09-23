import { initialWarMap } from '@frontline/core';

/** Sector names never change during a season: known before any live data loads. */
const SECTOR_NAMES = new Map<string, string>(
  initialWarMap().map((sector) => [sector.id, sector.name]),
);

/** The name of a sector, or null for an id that is not on the map. */
export const sectorNameOf = (id: string): string | null => SECTOR_NAMES.get(id) ?? null;
