import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // חייב להתאים ל-PORT ב-backend/.env (5000 או 5001)
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
        secure: false,
      },
      // תמונות פרופיל – הבאק צריך להגיש תיקיית uploads (express.static)
      "/uploads": {
        target: "http://localhost:5001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
