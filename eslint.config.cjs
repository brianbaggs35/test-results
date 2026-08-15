const { defineConfig, globalIgnores } = require('eslint/config')
const globals = require('globals')
const js = require('@eslint/js')
const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const reactRefreshPackage = require('eslint-plugin-react-refresh')
const reactHooks = require('eslint-plugin-react-hooks')

const reactRefresh = reactRefreshPackage.reactRefresh

module.exports = defineConfig([
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
      'playwright.config.{js,ts}',
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
    '**/eslint.config.cjs',
    '**/coverage',
    '**/.history',
    '**/node_modules',
    '**/playwright-report',
    '**/test-results',
  ]),
])
