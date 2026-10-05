import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    // DB integration tests share one database and reset it, so files must not run in parallel.
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
    env: { JWT_SECRET: 'test-secret-not-for-production' }
  }
});
