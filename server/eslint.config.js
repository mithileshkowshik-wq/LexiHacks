import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['node_modules', 'public']),
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended, eslintConfigPrettier],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // req/next often unused in Express handlers; err param must stay for error middleware
      // ignoreRestSiblings: destructuring a key out just to omit it from ...rest is intentional, not unused
      'no-unused-vars': ['error', { argsIgnorePattern: '^(req|res|next)$', ignoreRestSiblings: true }],
    },
  },
]);
