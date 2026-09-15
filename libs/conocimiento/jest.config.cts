/**
 * Pruebas unitarias: no necesitan base de datos y corren dentro de `pnpm verify`.
 * Las de integracion (`*.int-spec.ts`) tienen su propia configuracion.
 */
module.exports = {
  displayName: 'conocimiento',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testPathIgnorePatterns: ['/node_modules/', '\\.int-spec\\.ts$'],
  coverageDirectory: '../../coverage/libs/conocimiento',
};
