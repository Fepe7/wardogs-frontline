import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    // Rules tests share the emulators, so they must not run in parallel.
    fileParallelism: false,
  },
});
