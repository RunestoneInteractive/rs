import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }: { mode: string }) => {
  let basedir = "/";

  if (mode === "production") {
    basedir = "/assignment/instructor/";
  }

  return {
    build: {
      outDir: "../react",
      base: basedir,
      manifest: true
    },
    server: {
      proxy: {
        "/ns": "http://localhost",
        "/assignment": "http://localhost"
      }
    },
    base: basedir,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@store": path.resolve(__dirname, "./src/store"),
        "@components": path.resolve(__dirname, "./src/components")
      }
    },
    plugins: [react()],
    optimizeDeps: {
      include: ["react", "react-dom", "quill"]
    }
  };
});
