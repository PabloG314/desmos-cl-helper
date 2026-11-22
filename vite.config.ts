/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/desmos-cl-helper/',
  build: {
    rollupOptions: {
      // Two static pages: the app and the tutorial (DESIGN.md section 18).
      input: {
        main: 'index.html',
        tutorial: 'tutorial.html',
      },
    },
  },
  test: {
    passWithNoTests: true,
  },
});
