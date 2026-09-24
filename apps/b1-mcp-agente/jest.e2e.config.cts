/**
 * Pruebas de punta a punta de B1: exigen `pnpm dev:b1` (o los dos procesos
 * construidos) y PostgreSQL arriba, y gastan tokens del proveedor salvo en
 * `replay`. No forman parte de `pnpm verify`; se corren con `pnpm nx e2e b1-mcp-agente`.
 */
module.exports = {
  displayName: 'b1-mcp-agente-e2e',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  testMatch: ['<rootDir>/src/**/*.e2e-spec.ts'],
  testTimeout: 300_000,
  coverageDirectory: '../../coverage/apps/b1-mcp-agente-e2e',
};
