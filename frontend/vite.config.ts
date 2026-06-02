import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Must match backend PORT. Local `npm run dev` defaults backend to 5000 (per
  // backend/.env). For dev:docker (host port 5001) set VITE_API_URL=http://127.0.0.1:5001.
  const apiTarget =
    (env.VITE_API_URL && env.VITE_API_URL.replace(/\/$/, "")) ||
    "http://127.0.0.1:5000";

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
