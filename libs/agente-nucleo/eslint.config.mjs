import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    // Clean Architecture: el dominio es TypeScript puro, sin ORM ni NestJS.
    files: ['src/dominio/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@nestjs/*',
                'typeorm',
                'typeorm/*',
                'pg',
                'node:*',
                '**/aplicacion/**',
                '**/infraestructura/**',
              ],
              message: 'dominio/ no depende de frameworks, de la base de datos ni de otras capas.',
            },
          ],
        },
      ],
    },
  },
  {
    // Los casos de uso solo conocen el puerto; la implementacion la inyecta el modulo.
    files: ['src/aplicacion/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['typeorm', 'typeorm/*', 'pg', '**/infraestructura/**'],
              message:
                'Inyecta el puerto (token de aplicacion/tokens.ts), nunca una implementacion de infraestructura/.',
            },
          ],
        },
      ],
    },
  },
];
