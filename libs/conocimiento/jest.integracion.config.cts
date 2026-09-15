/**
 * Pruebas de integracion contra PostgreSQL real. Requieren la base levantada con
 * `pnpm conocimiento:db`; ver libs/conocimiento/README.md.
 */
module.exports = {
  displayName: 'conocimiento-integracion',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.int-spec.ts'],
  testTimeout: 60000,
  coverageDirectory: '../../coverage/libs/conocimiento-integracion',
};
