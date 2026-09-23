import { Timestamp } from 'firebase-admin/firestore';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;

/** Domain objects use Date; Firestore stores Timestamp. Converts recursively on the way in. */
export const toFirestoreData = (value: unknown): unknown => {
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (Array.isArray(value)) return value.map(toFirestoreData);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, field]) => [key, toFirestoreData(field)]),
    );
  }
  return value;
};

/** Converts Timestamps back to Date on the way out. */
export const fromFirestoreData = (value: unknown): unknown => {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(fromFirestoreData);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, field]) => [key, fromFirestoreData(field)]),
    );
  }
  return value;
};
