/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/strict'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // 禁止使用 any
    '@typescript-eslint/no-explicit-any': 'error',
    // 禁止未使用的变量
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }
    ],
    // 优先使用 const
    'prefer-const': 'error',
    // 禁止 console（开发环境除外）
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off'
  },
  ignorePatterns: ['dist-electron', 'out', 'node_modules', '*.config.js', '*.config.ts']
}
