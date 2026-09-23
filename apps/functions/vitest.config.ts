import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Same resolution as tsconfig paths / esbuild: the core is bundled, not installed.
    alias: {
      '@frontline/core': fileURLToPath(
        new URL('../../packages/core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['src/**/*.spec.ts'],
    // Integration tests share one emulator, so they must not run in parallel.
    fileParallelism: false,
  },
});
