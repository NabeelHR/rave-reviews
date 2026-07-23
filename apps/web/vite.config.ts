import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev proxy: browser hits /api/*, Vite forwards to the Fastify server.
// Keeps CORS out of iteration 1.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
