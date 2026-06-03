import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Must match backend PORT (backend/.env.example uses 5001). Override via VITE_API_URL.
  const apiTarget =
    (env.VITE_API_URL && env.VITE_API_URL.replace(/\/$/, "")) ||
    "http://127.0.0.1:5001";

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        "/uploads": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
