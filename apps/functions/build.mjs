// Bundles the functions into dist/index.js. Workspace packages (@frontline/core) are
// resolved through tsconfig paths and bundled; runtime dependencies stay external and
// are installed by Cloud Build from package.json.
import { build } from 'esbuild';
import { readFile, rm } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));

// `--seed` builds the local seeding script instead (pnpm seed:demo). It goes under
// node_modules/.cache so it is never deployed with dist/.
const seed = process.argv.includes('--seed');
const outfile = seed ? 'node_modules/.cache/seed-demo.mjs' : 'dist/index.js';
if (!seed) await rm('dist', { recursive: true, force: true });

await build({
  entryPoints: [seed ? 'src/simulation/seed-demo.ts' : 'src/index.ts'],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  tsconfig: 'tsconfig.json',
  external: Object.keys(pkg.dependencies),
});
