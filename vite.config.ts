/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// tech-architecture.md §5.3: Vite build → 정적 번들(HTML/JS/CSS) = 웹·데스크톱 공통 산출.
// 상대 경로(base: './')로 빌드해 itch.io / NW.js(package.nw) 양쪽에서 그대로 로드되게 한다.
export default defineConfig({
  base: './',
  plugins: [svelte()],
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
  },
  // vitest 설정 (tech-spec §3: vitest로 코어 수식/세이브 단위 검증)
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});
