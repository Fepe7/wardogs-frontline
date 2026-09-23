/** Build settings. The dev and prod Firebase projects are added when the demo is deployed. */
export const environment = {
  /** Dev demo: the war runs on bots and simulated matches (docs/DISEÑO.md §5). */
  demoMode: true,
  /** Web config of a `demo-*` project: it only works against the emulators, never production. */
  firebase: {
    projectId: 'demo-frontline',
    apiKey: 'demo-api-key',
    appId: 'demo-frontline-web',
  },
  /** Firebase Emulator Suite (ports in firebase.json). Null to use the real project. */
  emulators: { host: '127.0.0.1', firestorePort: 8080 } as {
    readonly host: string;
    readonly firestorePort: number;
  } | null,
} as const;
