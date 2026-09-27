/**
 * Pruebas de punta a punta de B2: exigen `pnpm dev:b2` (mcp-server y B2) y
 * PostgreSQL arriba, y llaman al modelo configurado (Ollama en local). No forman
 * parte de `pnpm verify`; se corren con `pnpm nx e2e b2-multiagente-local`.
 */
module.exports = {
  displayName: 'b2-multiagente-local-e2e',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  testMatch: ['<rootDir>/src/**/*.e2e-spec.ts'],
  testTimeout: 300_000,
  coverageDirectory: '../../coverage/apps/b2-multiagente-local-e2e',
};
