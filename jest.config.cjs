/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    // Strip .js extension from relative imports so ts-jest resolves .ts sources
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testTimeout: 30_000,
}
