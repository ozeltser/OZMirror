import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Set API_KEY before any module loads so the module-level const captures it.
    env: {
      API_KEY: 'test-api-key-system-stats',
    },
  },
});
