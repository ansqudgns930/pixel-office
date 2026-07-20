import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const controlPlaneUrl = process.env.VITE_CONTROL_PLANE_URL ?? "http://127.0.0.1:4310";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": { target: controlPlaneUrl, changeOrigin: true }
    }
  }
});