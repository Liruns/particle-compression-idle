/**
 * main — 엔트리. Svelte 앱을 #app에 마운트하고 디자인 토큰을 적용한다.
 * (tech-architecture.md §4.1: 표현 진입점. 로직은 game.ts/core가 담당.)
 */
import './ui/tokens.css'; // DESIGN.md 토큰을 :root에 주입(가장 먼저).
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Mount target #app not found.');
}

const app = new App({ target });

export default app;
