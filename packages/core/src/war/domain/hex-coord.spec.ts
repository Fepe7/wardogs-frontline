import { describe, expect, it } from 'vitest';
import { areAdjacent, hexKey, neighborsOf, type HexCoord } from './hex-coord';

const origin: HexCoord = { q: 0, r: 0 };

describe('HexCoord (axial coordinates)', () => {
  it('has six neighbours', () => {
    expect(neighborsOf(origin)).toEqual([
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 },
    ]);
  });

  it('considers two touching hexes adjacent', () => {
    expect(areAdjacent(origin, { q: 1, r: -1 })).toBe(true);
    expect(areAdjacent({ q: 2, r: 3 }, { q: 2, r: 4 })).toBe(true);
  });

  it('does not consider distant hexes or the same hex adjacent', () => {
    expect(areAdjacent(origin, { q: 2, r: 0 })).toBe(false);
    expect(areAdjacent(origin, { q: 1, r: 1 })).toBe(false);
    expect(areAdjacent(origin, origin)).toBe(false);
  });

  it('builds a stable key to index hexes', () => {
    expect(hexKey({ q: -2, r: 5 })).toBe('-2,5');
  });
});
