import react from '@vitejs/plugin-react';
import { defineConfig as viteDefineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import commonjs from 'vite-plugin-commonjs';
import viteTsconfig from 'vite-tsconfig-paths';
import { defineConfig, mergeConfig } from 'vitest/config';

import svgTransformFile from './scripts/svgTransformFile';

export default mergeConfig(
  viteDefineConfig({
    base: '/',
    plugins: [
      viteTsconfig(),
      checker({
        typescript: true,
      }),
      {
        name: 'transform-svg',
        transform(_, fileName) {
          if (fileName.endsWith('.svg')) return svgTransformFile(fileName);
        },
      },
      react(),
      commonjs(),
    ],
  }),
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: 'vitest.setup.ts',
      testTimeout: 10000,
      hookTimeout: 10000,
      include: ['src/**/*.spec.*'],
      clearMocks: true,
      coverage: {
        provider: 'istanbul',
        reporter: ['html', 'text'],
        include: ['src/**/*.{ts,tsx}'],
        reportOnFailure: true,
      },
      pool: 'threads',
      poolOptions: {
        threads: {
          minThreads: 4,
          maxThreads: 8,
        },
      },
    },
  }),
);
