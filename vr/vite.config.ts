import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: './',
  plugins: [react(), ...(process.env.NO_SSL ? [] : [basicSsl()])],
  server: { host: true, port: 5173 },
  test: { include: ['src/tests/**/*.test.ts'] },
});
