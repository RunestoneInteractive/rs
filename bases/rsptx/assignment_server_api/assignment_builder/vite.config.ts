import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }: { mode: string }) => {
  let basedir = "/";
  if (mode === "production") {
    basedir = "/assignment/instructor/builder";
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
    // base: "/assignment/react/", // this changes the base for dev as well as prod :-(
    // see:  https://vitejs.dev/config/ to conditionalize this
    base: basedir,
    resolve: {
      alias: {
        "@": "/src",
        "@store": "/src/store",
        "@components": "/src/components"
      }
    },
    plugins: [react()]
  };
});
