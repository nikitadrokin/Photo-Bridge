//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config';

export default [
  ...tanstackConfig,
  {
    rules: {
      'import/consistent-type-specifier-style': 'off',
    },
  },
];
