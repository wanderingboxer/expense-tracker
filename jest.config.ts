import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'node',
  moduleNameMapper: {
    // Prisma 7's generated client dynamically imports its WASM
    // query-compiler runtime from ESM (.mjs) files, which Jest's CJS module
    // system can't parse ("Unexpected token 'export'"). Redirect those
    // specific imports to Prisma's own CJS-compiled equivalents, which exist
    // in the same directory for exactly this kind of interop.
    '^@prisma/client/runtime/query_compiler_fast_bg\\.postgresql\\.mjs$':
      '<rootDir>/node_modules/@prisma/client/runtime/query_compiler_fast_bg.postgresql.js',
    '^@prisma/client/runtime/query_compiler_fast_bg\\.postgresql\\.wasm-base64\\.mjs$':
      '<rootDir>/node_modules/@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['<rootDir>/jest.setup.ts'],
  // Default testMatch picks up every file under __tests__/, including
  // non-test helper modules like __tests__/helpers/db.ts.
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/helpers/'],
};

export default createJestConfig(config);
