/** Build settings. The dev and prod Firebase projects are added when the demo is deployed. */
export interface Environment {
  /** Dev demo: the war runs on bots and simulated matches (docs/DISEÑO.md §5). */
  readonly demoMode: boolean;
  readonly firebase: {
    readonly projectId: string;
    readonly apiKey: string;
    readonly appId: string;
  };
  /** Firebase Emulator Suite (ports in firebase.json). Null to use the real project. */
  readonly emulators: {
    readonly host: string;
    readonly firestorePort: number;
    readonly functionsPort: number;
  } | null;
  /** Same region as the functions (docs/adr/0002). */
  readonly functionsRegion: string;
  /**
   * Public origin of the site, e.g. https://frontline.example. Link previews need
   * absolute URLs; null until the site has its address (it is set when deploying).
   */
  readonly siteUrl: string | null;
}

export const environment: Environment = {
  demoMode: true,
  // Web config of a `demo-*` project: it only works against the emulators, never production.
  firebase: { projectId: 'demo-frontline', apiKey: 'demo-api-key', appId: 'demo-frontline-web' },
  emulators: { host: '127.0.0.1', firestorePort: 8080, functionsPort: 5001 },
  functionsRegion: 'europe-west1',
  siteUrl: null,
};
