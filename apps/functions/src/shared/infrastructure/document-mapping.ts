import type { DocumentData } from 'firebase-admin/firestore';
import { fromFirestoreData, toFirestoreData } from './firestore-data';

/*
 * Documents are only ever written by the server-side repositories (clients cannot
 * write, see firestore.rules), so repositories cast what they read back to domain
 * types after converting Timestamps to Dates.
 */
export const fromDocument = (data: DocumentData | undefined): unknown => fromFirestoreData(data);

export const toDocument = (value: object): DocumentData => toFirestoreData(value) as DocumentData;
