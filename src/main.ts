/**
 * main — 엔트리. Svelte 앱을 #app에 마운트하고 디자인 토큰을 적용한다.
 * (tech-architecture.md §4.1: 표현 진입점. 로직은 game.ts/core가 담당.)
 */
// 폰트 에셋 — self-hosted @fontsource (오프라인 게임: 외부 CDN 비의존). DESIGN.md §3 서체.
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import './ui/tokens.css'; // DESIGN.md 토큰을 :root에 주입(폰트 로드 후).
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Mount target #app not found.');
}

const app = new App({ target });

export default app;
