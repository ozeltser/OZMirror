import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Set WEATHER_API_KEY before any module loads so the module-level const captures it.
    env: {
      WEATHER_API_KEY: 'test-weather-api-key',
    },
  },
});
