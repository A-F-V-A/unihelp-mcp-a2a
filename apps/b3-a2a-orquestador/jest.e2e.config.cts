/**
 * Pruebas de punta a punta de B3: exigen `pnpm dev:b3` (mcp-server, los dos
 * especialistas y el orquestador) y PostgreSQL arriba, y llaman al modelo
 * configurado (Ollama en desarrollo) salvo en `replay`. No forman parte de
 * `pnpm verify`; se corren con `pnpm nx e2e b3-a2a-orquestador`.
 */
module.exports = {
  displayName: 'b3-a2a-orquestador-e2e',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  testMatch: ['<rootDir>/src/**/*.e2e-spec.ts'],
  testTimeout: 300_000,
  coverageDirectory: '../../coverage/apps/b3-a2a-orquestador-e2e',
};
