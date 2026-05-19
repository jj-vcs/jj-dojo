const allowUnusedVarsWithUnderscorePrefix = {
  files: ['**/*.ts', '**/*.tsx'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
  },
};

const overrides = [allowUnusedVarsWithUnderscorePrefix];

module.exports = [...require('gts'), ...overrides];
