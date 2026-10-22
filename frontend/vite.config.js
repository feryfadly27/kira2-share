import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api ke backend lokal supaya tidak kena CORS saat dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      // Teruskan request gambar ke backend agar foto tampil (bukan 404/index.html).
      '/uploads': 'http://localhost:4000',
      // Halaman galeri & QR publik (disajikan backend).
      '/gallery': 'http://localhost:4000',
      '/qr': 'http://localhost:4000',
      '/view': 'http://localhost:4000',
      '/booth': 'http://localhost:4000',
    },
  },
});
