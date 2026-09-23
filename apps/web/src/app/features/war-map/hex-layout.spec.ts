import { neighborsOf } from '@frontline/core';
import { hexCenter, hexPoints, viewBoxFor } from './hex-layout';

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('hex layout', () => {
  it('puts the origin hex at the origin', () => {
    expect(hexCenter({ q: 0, r: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('places every neighbour at the same distance, so hexes tile without gaps', () => {
    const origin = hexCenter({ q: 0, r: 0 }, 10);
    const gaps = neighborsOf({ q: 0, r: 0 }).map((n) => distance(origin, hexCenter(n, 10)));

    for (const gap of gaps) expect(gap).toBeCloseTo(10 * Math.sqrt(3));
  });

  it('draws six corners at the hex size from the center', () => {
    const corners = hexPoints({ q: 1, r: 0 }, 10)
      .split(' ')
      .map((pair) => pair.split(',').map(Number) as [number, number]);
    const center = hexCenter({ q: 1, r: 0 }, 10);

    expect(corners).toHaveLength(6);
    for (const [x, y] of corners) expect(distance(center, { x, y })).toBeCloseTo(10, 1);
  });

  it('frames every hex in the viewBox', () => {
    const [minX, minY, width, height] = viewBoxFor([
      { q: -1, r: 0 },
      { q: 1, r: 0 },
    ])
      .split(' ')
      .map(Number) as [number, number, number, number];

    expect(minX).toBeLessThan(hexCenter({ q: -1, r: 0 }).x - 10);
    expect(minX + width).toBeGreaterThan(hexCenter({ q: 1, r: 0 }).x + 10);
    expect(minY).toBeLessThan(-10);
    expect(height).toBeGreaterThan(20);
  });
});
