import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // חייב להתאים ל-PORT ב-backend/.env וב-backend/server.js
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5001",
        changeOrigin: true,
        secure: false,
      },
      // תמונות פרופיל – אותו שרת כמו /api
      "/uploads": {
        target: "http://127.0.0.1:5001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
