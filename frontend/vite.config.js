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
    proxy: {
      "/api": {
	      target: process.env.API_TARGET || "http://192.168.16.5:8000",
        changeOrigin: true,
      },
    },
  },
});
