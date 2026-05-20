import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/testing/vscode_module_mock'],
    include: ['src/**/*.test.ts', 'lib/**/*.test.ts'],
    typecheck: {
      enabled: true,
    },
  },
});
