import nx from '@nx/eslint-plugin';

/**
 * Configuracion ESLint compartida por todo el monorepo. Cada proyecto la extiende
 * desde su propio `eslint.config.mjs`.
 *
 * La pieza clave es `@nx/enforce-module-boundaries`: las restricciones por tag
 * garantizan que ninguna arquitectura importe codigo de otra. El aislamiento
 * entre B0, B1, B2 y B3 deja de ser una convencion y pasa a ser una regla que
 * falla en CI.
 */
export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/.angular', '**/coverage'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // Las apps consumen librerias; nunca otras apps.
            {
              sourceTag: 'tipo:app',
              onlyDependOnLibsWithTags: ['tipo:lib'],
            },
            // Las librerias compartidas no pueden depender de ninguna arquitectura.
            {
              sourceTag: 'arq:compartido',
              onlyDependOnLibsWithTags: ['arq:compartido'],
            },
            // Cada arquitectura solo alcanza lo compartido, jamas a sus pares.
            {
              sourceTag: 'arq:b0',
              onlyDependOnLibsWithTags: ['arq:compartido'],
            },
            {
              sourceTag: 'arq:b1',
              onlyDependOnLibsWithTags: ['arq:compartido'],
            },
            {
              sourceTag: 'arq:b2',
              onlyDependOnLibsWithTags: ['arq:compartido'],
            },
            {
              sourceTag: 'arq:b3',
              onlyDependOnLibsWithTags: ['arq:compartido'],
            },
            // El frontend es unico y solo conoce los contratos compartidos. Nunca
            // una libreria de backend: arrastraria TypeORM al bundle (decision 16).
            {
              sourceTag: 'arq:frontend',
              onlyDependOnLibsWithTags: ['arq:compartido'],
              notDependOnLibsWithTags: ['alcance:backend'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    rules: {
      // Los tipos compartidos viven en `libs/`; se prefiere `import type`
      // para que no queden dependencias de runtime innecesarias en los bundles.
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];
