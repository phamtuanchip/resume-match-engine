import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'tmp/**', 'data/**', 'scripts/**', '**/*.js', '**/*.mjs'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
        node: true,
      },
    },
    languageOptions: {
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    rules: {
      // Deliberately OFF: this project uses NestJS DI with `emitDecoratorMetadata`, where
      // constructor-injected classes appear type-only to the linter but MUST remain runtime
      // (value) imports — `import type` would erase them and break dependency injection.
      '@typescript-eslint/consistent-type-imports': 'off',
      // Import hygiene: single statement per module, deterministic ordering, no cycles.
      'import/no-duplicates': 'error',
      'import/no-cycle': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [{ pattern: '@{core,common,presentation}/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'never',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      // NestJS DI modules are intentionally empty classes.
      '@typescript-eslint/no-extraneous-class': 'off',
      // `_`-prefixed args/vars are intentionally unused (interface-mandated params, etc.).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Barrels legitimately re-export everything from a module.
    files: ['**/index.ts'],
    rules: { 'import/export': 'off' },
  },
  {
    // Tests legitimately parse dynamic JSON output (any) and use require() for mock isolation.
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-cycle': 'off',
    },
  },
  prettier,
);
