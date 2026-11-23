import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages: Qyeniic.github.io 저장소면 base는 '/'. 다른 이름의 저장소면 '/저장소이름/'.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
});
