import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [VitePWA({ registerType: 'autoUpdate' })],
  // server: {
  //   host: '127.0.0.1',
  //   port: 5174,
  //   strictPort: false,
  // },
  // preview: {
  //   host: '127.0.0.1',
  //   port: 5174,
  //   strictPort: false,
  // },
});
