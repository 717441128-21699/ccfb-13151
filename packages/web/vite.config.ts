import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@mahjong/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      '@mahjong/rules': fileURLToPath(new URL('../rules/src/index.ts', import.meta.url)),
      '@mahjong/validate': fileURLToPath(new URL('../validate/src/index.ts', import.meta.url)),
    },
  },
  server: { port: 5173, open: true },
});
