import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(({ mode }: { mode: string }) => {
  let basedir = "/";
  const assignmentProxy = process.env.ASSIGNMENT_PROXY_URL;
  const adminProxy = process.env.ADMIN_PROXY_URL;

  if (mode === "production") {
    basedir = "/assignment/instructor/";
  }

  return {
    build: {
      outDir: "../react",
      base: basedir,
      manifest: true,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, "index.html"),
          editorialHtmlRenderer: path.resolve(__dirname, "src/editorialHtmlRenderer.ts")
        },
        output: {
          entryFileNames: (chunkInfo) =>
            chunkInfo.name === "editorialHtmlRenderer"
              ? "assets/editorial-html-renderer.js"
              : "assets/[name]-[hash].js"
        }
      }
    },
    server: {
      proxy: {
        "/ns": "http://localhost",
        "/admin": adminProxy
          ? {
              target: adminProxy,
              rewrite: (requestPath) => requestPath.replace(/^\/admin/, "")
            }
          : "http://localhost",
        "/assignment": assignmentProxy
          ? {
              target: assignmentProxy,
              rewrite: (requestPath) => requestPath.replace(/^\/assignment/, "")
            }
          : "http://localhost"
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
      include: ["react", "react-dom"]
    }
  };
});
