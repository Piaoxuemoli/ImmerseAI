import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

export default [
  {
    ignores: [
      'dist-electron/**',
      'dist/**',
      'out/**',
      'node_modules/**',
      'docs/spikes/**',
      '*.config.js',
      '*.config.ts',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        process: 'readonly',
        self: 'readonly',
        fetch: 'readonly',
        Headers: 'readonly',
        Response: 'readonly',
        Blob: 'readonly',
        ReadableStream: 'readonly',
        MessageEvent: 'readonly',
        ErrorEvent: 'readonly',
        Worker: 'readonly',
        caches: 'readonly',
        crypto: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        AbortSignal: 'readonly',
        Buffer: 'readonly',
        IDBDatabase: 'readonly',
        indexedDB: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...tsPlugin.configs.strict.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'prefer-const': 'error',
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    },
  },
]
