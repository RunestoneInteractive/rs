import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
    return {
        build: {
            outDir: "build",
        },
        server: {
            proxy: {
                "/ns": "http://localhost",
                "/assignment": "http://localhost",
            },
        },
        // base: "/assignment/react/", // this changes the base for dev as well as prod :-(
        plugins: [react()],
    };
});
