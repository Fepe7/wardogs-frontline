/** Build settings, one file per target: environment.ts (local, emulators) and environment.dev.ts (the public demo). */
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
  /** reCAPTCHA Enterprise site key for App Check; null against the emulators. */
  readonly appCheckSiteKey: string | null;
}
