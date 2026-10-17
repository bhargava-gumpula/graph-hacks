import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: { "/api": "http://localhost:8787" },
  },
});
