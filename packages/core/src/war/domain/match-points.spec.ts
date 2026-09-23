import { describe, expect, it } from 'vitest';
import type { FactionPlacements } from '../../shared/domain/faction';
import { pointsForMatch } from './match-points';

describe('pointsForMatch', () => {
  it('awards 3 points to the winner, 2 to the runner-up and 1 to the third', () => {
    const placements: FactionPlacements = {
      first: 'manticore',
      second: 'valkyra',
      third: 'lonestar',
    };

    expect(pointsForMatch(placements)).toEqual({ manticore: 3, valkyra: 2, lonestar: 1 });
  });
});
