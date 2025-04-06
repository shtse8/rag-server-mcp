import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Apply base JS rules globally
  js.configs.recommended,

  // Apply base TS rules globally (those not requiring type info)
  ...tseslint.configs.recommended,

  // Configuration specific to TypeScript files, including type-aware rules
  {
    files: ['**/*.ts'],
    extends: [ // Use extends to apply recommended and strict type-checked rulesets
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.strictTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: true, // Enable type-aware linting
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Add any project-specific overrides here
      // Example: Allow unused vars starting with _
      // '@typescript-eslint/no-unused-vars': [
      //   'error',
      //   { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }
      // ],
    },
  },

  // Configuration for CommonJS files (like .prettierrc.cjs)
  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        exports: 'writable',
      },
      sourceType: 'commonjs',
    },
  },

  // Configuration for MJS files (like scripts)
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
      sourceType: 'module', // MJS files are ES Modules
    },
  },

  // Global ignores
  {
    ignores: ['dist/', 'node_modules/'],
  },

  // Prettier config must be last to override other formatting rules
  eslintConfigPrettier,
);
