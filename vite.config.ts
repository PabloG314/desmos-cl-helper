/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/cl-helper/',
  test: {
    passWithNoTests: true,
  },
});
