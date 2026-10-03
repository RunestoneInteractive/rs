import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig as viteDefineConfig } from "vite";
import commonjs from "vite-plugin-commonjs";
import viteTsconfig from "vite-tsconfig-paths";
import { defineConfig, mergeConfig } from "vitest/config";

import svgTransformFile from "./scripts/svgTransformFile";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default mergeConfig(
  viteDefineConfig({
    base: "/",
    root: projectRoot,
    plugins: [
      viteTsconfig(),
      {
        name: "transform-svg",
        transform(_, fileName) {
          if (fileName.endsWith(".svg")) return svgTransformFile(fileName);
        }
      },
      react(),
      commonjs()
    ]
  }),
  defineConfig({
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: fileURLToPath(new URL("./vitest.setup.ts", import.meta.url)),
      testTimeout: 10000,
      hookTimeout: 10000,
      include: ["src/**/*.spec.*", "src/**/*.test.*"],
      clearMocks: true,
      coverage: {
        provider: "istanbul",
        reporter: ["html", "text"],
        include: ["src/**/*.{ts,tsx}"],
        reportOnFailure: true
      },
      pool: "threads",
      poolOptions: {
        threads: {
          minThreads: 4,
          maxThreads: 8
        }
      }
    }
  })
);
