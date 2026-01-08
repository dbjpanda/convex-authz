import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  envDir: "../",
  plugins: [react(), tailwindcss()],
  resolve: {
    conditions: ["@convex-dev/component-source"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@convex": path.resolve(__dirname, "./convex"),
    },
  },
});
