import type { Environment } from './environment.model';

export const environment: Environment = {
  demoMode: true,
  // Web config of a `demo-*` project: it only works against the emulators, never production.
  firebase: { projectId: 'demo-frontline', apiKey: 'demo-api-key', appId: 'demo-frontline-web' },
  emulators: { host: '127.0.0.1', firestorePort: 8080, functionsPort: 5001 },
  functionsRegion: 'europe-west1',
  siteUrl: null,
  appCheckSiteKey: null,
};
