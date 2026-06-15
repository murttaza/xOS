module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // Existing `any` debt is tracked as warnings (paid down incrementally) so it
    // stays visible without blocking the build; new hard errors still fail CI.
    '@typescript-eslint/no-explicit-any': 'warn',
    // Underscore-prefixed args/vars/catch bindings are intentional placeholders.
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
    // Empty catch blocks are an intentional "best-effort, ignore failure" idiom here.
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
}
