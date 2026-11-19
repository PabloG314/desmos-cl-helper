/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/desmos-cl-helper/',
  test: {
    passWithNoTests: true,
  },
});
