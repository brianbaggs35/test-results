import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import { reactRefresh } from 'eslint-plugin-react-refresh'
import reactHooks from 'eslint-plugin-react-hooks'

export default defineConfig([
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],

    languageOptions: {
      globals: {
        ...globals.browser,
        React: 'readonly',
      },

      parser: tsParser,

      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },

    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-refresh': reactRefresh.plugin,
      'react-hooks': reactHooks,
    },

    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,

      'no-undef': 'off',

      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
        },
      ],

      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  {
    files: [
      '*.config.{js,ts}',
      'server/**/*.{js,ts}',
      'spec/**/*.{js,jsx,ts,tsx}',
    ],

    languageOptions: {
      globals: {
        ...globals.node,
      },

      parser: tsParser,

      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },

    plugins: {
      '@typescript-eslint': tsPlugin,
    },

    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,

      'no-undef': 'off',
    },
  },

  {
    files: ['src/test/**/*.{js,jsx,ts,tsx}'],

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        React: 'readonly',
      },

      parser: tsParser,

      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },

    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-refresh': reactRefresh.plugin,
      'react-hooks': reactHooks,
    },

    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,

      'no-undef': 'off',

      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
        },
      ],

      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  globalIgnores([
    '**/dist',
    '**/.eslintrc.cjs',
    '**/eslint.config.ts',
    '**/coverage',
    '**/.history',
    '**/node_modules',
    '**/playwright-report',
    '**/test-results',
  ]),
])
