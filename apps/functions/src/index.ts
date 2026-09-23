import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import { GAME_CONFIG } from '@frontline/core';

// Every function runs in the same region as Firestore (docs/adr/0002).
// maxInstances caps the cost of a traffic spike or abuse.
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

/** Liveness probe used to verify the functions pipeline end to end. */
export const health = onRequest((_request, response) => {
  response.json({ status: 'ok', pointsByPlacement: GAME_CONFIG.pointsByPlacement });
});
