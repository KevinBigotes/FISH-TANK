import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true, host: process.env.FISH_TANK_LAN === 'true' ? '0.0.0.0' : '127.0.0.1' },
  preview: { port: 4173, strictPort: true },
});
