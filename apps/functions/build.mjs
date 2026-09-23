// Bundles the functions into dist/index.js. Workspace packages (@frontline/core) are
// resolved through tsconfig paths and bundled; runtime dependencies stay external and
// are installed by Cloud Build from package.json.
import { build } from 'esbuild';
import { readFile, rm } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));

await rm('dist', { recursive: true, force: true });

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  tsconfig: 'tsconfig.json',
  external: Object.keys(pkg.dependencies),
});
