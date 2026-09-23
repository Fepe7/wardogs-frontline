import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, map, ok } from './result';

describe('Result', () => {
  it('wraps a successful value', () => {
    const result = ok(3);

    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
    expect(result).toEqual({ ok: true, value: 3 });
  });

  it('wraps an expected error', () => {
    const result = err('sector-not-adjacent');

    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
    expect(result).toEqual({ ok: false, error: 'sector-not-adjacent' });
  });

  it('transforms the value of a success', () => {
    expect(map(ok(2), (points) => points * 2)).toEqual(ok(4));
  });

  it('leaves an error untouched when mapping', () => {
    const failure = err('battle-closed');

    expect(map(failure, (points: number) => points * 2)).toBe(failure);
  });
});
