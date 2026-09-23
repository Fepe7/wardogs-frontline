// @ts-check
import js from '@eslint/js';
import angular from 'angular-eslint';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Architecture rules (docs/ARQUITECTURA.md §3): dependencies only point inward,
 * and bounded contexts never import each other's internals.
 */
const architecture = {
  files: ['packages/**/*.ts', 'apps/**/*.ts'],
  plugins: { boundaries },
  settings: {
    'boundaries/elements': [
      { type: 'core-shared', pattern: 'packages/core/src/shared' },
      { type: 'core-config', pattern: 'packages/core/src/config' },
      { type: 'core-domain', pattern: 'packages/core/src/*/domain', capture: ['context'] },
      {
        type: 'core-application',
        pattern: 'packages/core/src/*/application',
        capture: ['context'],
      },
      { type: 'core-entry', pattern: 'packages/core/src' },
      { type: 'contracts', pattern: 'packages/contracts' },
      { type: 'functions', pattern: 'apps/functions' },
      { type: 'web', pattern: 'apps/web' },
    ],
    'boundaries/files': [
      { category: 'test', pattern: '**/*.spec.ts' },
      { category: 'tooling', pattern: '**/*.config.ts' },
    ],
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: ['packages/*/tsconfig.json', 'apps/*/tsconfig.json', 'firebase/tsconfig.json'],
      },
    },
  },
  rules: {
    'boundaries/dependencies': [
      'error',
      {
        default: 'disallow',
        checkAllOrigins: true,
        checkUnknownLocals: true,
        policies: [
          // Test files may import test tooling.
          {
            from: { file: { categories: 'test' } },
            allow: { to: { module: { origin: 'external', source: 'vitest' } } },
          },
          // Tooling config files (vitest.config.ts...) may use any external package.
          {
            from: { file: { categories: 'tooling' } },
            allow: { to: { module: { origin: 'external' } } },
          },
          // Shared kernel and config are pure leaves.
          {
            from: { element: { types: { anyOf: ['core-shared', 'core-config'] } } },
            allow: { to: { element: { type: '{{ from.element.types.[0] }}' } } },
          },
          // Domain: its own context, the shared kernel and config. Nothing external.
          {
            from: { element: { type: 'core-domain' } },
            allow: {
              to: [
                {
                  element: {
                    type: 'core-domain',
                    captured: { context: '{{ from.element.captured.context }}' },
                  },
                },
                { element: { types: { anyOf: ['core-shared', 'core-config'] } } },
              ],
            },
          },
          // Application: its own context (domain + application), shared and config.
          {
            from: { element: { type: 'core-application' } },
            allow: {
              to: [
                {
                  element: {
                    types: { anyOf: ['core-domain', 'core-application'] },
                    captured: { context: '{{ from.element.captured.context }}' },
                  },
                },
                { element: { types: { anyOf: ['core-shared', 'core-config'] } } },
              ],
            },
          },
          // The public entry point re-exports the core.
          {
            from: { element: { type: 'core-entry' } },
            allow: {
              to: {
                element: {
                  types: {
                    anyOf: ['core-shared', 'core-config', 'core-domain', 'core-application'],
                  },
                },
              },
            },
          },
          // Contracts: itself, zod and the core's public API. Workspace packages resolve to
          // local files, so `@frontline/core` is matched as the `core-entry` element.
          {
            from: { element: { type: 'contracts' } },
            allow: {
              to: [
                { element: { types: { anyOf: ['contracts', 'core-entry'] } } },
                { module: { origin: 'external', source: 'zod' } },
              ],
            },
          },
          // Apps: themselves, the core's public API, contracts and any library or Node built-in.
          {
            from: { element: { types: { anyOf: ['functions', 'web'] } } },
            allow: {
              to: [
                { element: { type: '{{ from.element.types.[0] }}' } },
                { element: { types: { anyOf: ['core-entry', 'contracts'] } } },
                { module: { origin: 'external' } },
                { module: { origin: 'core' } },
              ],
            },
          },
        ],
      },
    ],
  },
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/lib/**',
      '**/coverage/**',
      '**/.angular/**',
      'graphify-out/**',
      'raw/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.js'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['packages/*/vitest.config.ts', 'firebase/vitest.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  { files: ['**/*.js'], ...tseslint.configs.disableTypeChecked },
  {
    files: ['apps/web/**/*.ts'],
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
    },
  },
  {
    files: ['apps/web/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
  architecture,
  prettier,
);
