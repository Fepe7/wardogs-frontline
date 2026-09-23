/**
 * Outcome of an operation that can fail in an expected way (e.g. voting for a
 * non-adjacent sector). Expected failures are values, not exceptions, so the
 * compiler forces callers to handle them.
 */
export type Result<T, E> = Ok<T> | Err<E>;

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;

export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;

export const map = <T, U, E>(result: Result<T, E>, transform: (value: T) => U): Result<U, E> =>
  result.ok ? ok(transform(result.value)) : result;
