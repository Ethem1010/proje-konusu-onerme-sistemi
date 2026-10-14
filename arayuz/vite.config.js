import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Seyithan'ın sunucusu CORS'ta 5173'e izin veriyor; port değişmesin.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: './src/testKurulumu.js',
  },
});
