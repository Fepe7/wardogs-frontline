import type { Environment } from './environment.model';

/**
 * The public demo in the `dev` project: simulated war, real Firebase, static hosting.
 * The web API key is public by design; security comes from the rules and App Check.
 */
export const environment: Environment = {
  demoMode: true,
  firebase: {
    projectId: 'wardogs-frontline-dev',
    apiKey: 'AIzaSyBioU_f5BUB4dI8OQo7yNDQ1xOSH1wkIls',
    appId: '1:855024108648:web:fbe9b2e4cea5d1fb6927dd',
  },
  emulators: null,
  functionsRegion: 'europe-west1',
  siteUrl: 'https://wardogs-frontline-dev.web.app',
  // reCAPTCHA Enterprise key (public by design; restricted to the demo's domains).
  appCheckSiteKey: '6LdvY8wtAAAAABUS_Z39s6EuAtiARF35R9Pl7p0R',
};
