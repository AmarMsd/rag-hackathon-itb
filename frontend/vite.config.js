import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Saat pengembangan di Mac, permintaan /api diteruskan ke server di Raspberry Pi.
// Ganti alamatnya lewat variabel API_TARGET bila hostname Pi berbeda.
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {},
  },
  server: {
    proxy: { "/api": process.env.API_TARGET || "http://artemis.local:8000" },
  },
});
