import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    // Clean Architecture: el dominio es TypeScript puro (sin Angular ni RxJS).
    files: ['src/app/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@angular/*',
                'rxjs',
                'rxjs/*',
                '**/application/**',
                '**/infrastructure/**',
                '**/presentation/**',
              ],
              message: 'domain/ no depende de frameworks ni de otras capas.',
            },
          ],
        },
      ],
    },
  },
  {
    // Ni casos de uso, ni store, ni componentes conocen una implementacion
    // concreta: solo los puertos. La eleccion vive en `provideDataLayer()`.
    files: ['src/app/application/**/*.ts', 'src/app/presentation/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**', '**/environments/**'],
              message:
                'Inyecta el puerto (token de application/di), nunca una implementacion de infrastructure/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
