import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
    return {
        build: {
            outDir: "build",
        },
        server: {
            proxy: {
                "/ns": "http://localhost:8080",
                "/assignment": "http://localhost:8080",
            },
        },
        // base: "/assignment/react/", // this changes the base for dev as well as prod :-(
        plugins: [react()],
    };
});
