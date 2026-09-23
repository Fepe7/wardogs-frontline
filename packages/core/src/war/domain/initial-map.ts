import { FACTIONS, type Faction } from '../../shared/domain/faction';
import { neighborsOf, type HexCoord } from './hex-coord';
import type { Sector, SectorId } from './war-map';

/** Rings of sectors around the empty center of the map. */
const MAP_RADIUS = 3;
/** Each ring has 6 sides; every faction holds 2 consecutive sides (a 120° wedge). */
const SIDES_PER_FACTION = 2;
/** Direction index (see hex-coord) that leads from the center to where a ring walk starts. */
const RING_START_DIRECTION = 4;

// Original names, one per sector, in the order the rings are walked.
const SECTOR_NAMES = [
  'Rust Hollow',
  'Iron Ford',
  'Cinder Gap',
  'Dry Creek',
  'Saltmarsh',
  'Ashfall',
  'Broken Mile',
  'Copper Flats',
  'Red Mesa',
  'Gravel Pit',
  'Hangman Ridge',
  'Dustbowl',
  'Signal Hill',
  'Old Quarry',
  'Thornfield',
  'Blackwater',
  'Pylon Row',
  'Kestrel Point',
  'Sulfur Lake',
  'Deadwood',
  'Canyon Gate',
  'Stormbreak',
  'Foundry',
  'Lookout',
  'Cobalt Mine',
  'Fallow Farm',
  'Bramble Pass',
  'Slag Heap',
  'Coldwater',
  'Watchtower',
  'Scrapyard',
  'High Plains',
  'Radio Mast',
  'Ember Fields',
  'Wolf Run',
  'Last Stand',
] as const;

const scaled = (direction: HexCoord, factor: number): HexCoord => ({
  q: direction.q * factor,
  r: direction.r * factor,
});

const neighborTowards = (coord: HexCoord, direction: number): HexCoord =>
  neighborsOf(coord)[direction] ?? coord;

/** Walks one ring side by side; each hex is tagged with the faction that owns its side. */
const ring = (radius: number): { coord: HexCoord; owner: Faction }[] => {
  const hexes: { coord: HexCoord; owner: Faction }[] = [];
  let coord = scaled(neighborTowards({ q: 0, r: 0 }, RING_START_DIRECTION), radius);
  for (let side = 0; side < 6; side += 1) {
    const owner = FACTIONS[Math.floor(side / SIDES_PER_FACTION)] ?? FACTIONS[0];
    for (let step = 0; step < radius; step += 1) {
      hexes.push({ coord, owner });
      coord = neighborTowards(coord, side);
    }
  }
  return hexes;
};

const idFrom = (name: string): SectorId => name.toLowerCase().replaceAll(' ', '-') as SectorId;

/**
 * The map every season starts from: a hexagon of radius 3 without its center, split
 * into three equal wedges of 12 sectors. Each faction borders the other two, so all of
 * them can attack from the first vote round.
 */
export const initialWarMap = (): Sector[] =>
  Array.from({ length: MAP_RADIUS }, (_, i) => ring(i + 1))
    .flat()
    .map(({ coord, owner }, index) => {
      const name = SECTOR_NAMES[index] ?? `Sector ${String(index + 1)}`;
      return { id: idFrom(name), name, coord, owner };
    });
