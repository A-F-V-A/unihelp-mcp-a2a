/**
 * Pruebas de punta a punta de B0: exigen B0 arriba con UNIHELP_PERFIL=experimento (`pnpm dev:b0`
 * o el proceso construido) y PostgreSQL migrada y sembrada, y un modelo real
 * (Ollama no gasta API de pago). No forman parte de `pnpm verify`; se corren con `pnpm nx e2e b0-directo`.
 */
module.exports = {
  displayName: 'b0-directo-e2e',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  testMatch: ['<rootDir>/src/**/*.e2e-spec.ts'],
  testTimeout: 300_000,
  coverageDirectory: '../../coverage/apps/b0-directo-e2e',
};
