/**
 * Axial coordinates of a hexagonal grid (https://www.redblobgames.com/grids/hexagons/).
 * The implicit third cube coordinate is s = -q - r.
 */
export interface HexCoord {
  readonly q: number;
  readonly r: number;
}

const NEIGHBOR_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const neighborsOf = (coord: HexCoord): HexCoord[] =>
  NEIGHBOR_DIRECTIONS.map((direction) => ({ q: coord.q + direction.q, r: coord.r + direction.r }));

export const areAdjacent = (a: HexCoord, b: HexCoord): boolean =>
  neighborsOf(a).some((neighbor) => neighbor.q === b.q && neighbor.r === b.r);

export const hexKey = (coord: HexCoord): string => `${String(coord.q)},${String(coord.r)}`;
