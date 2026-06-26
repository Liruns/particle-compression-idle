/**
 * main — 엔트리. Svelte 앱을 #app에 마운트하고 디자인 토큰을 적용한다.
 * (tech-architecture.md §4.1: 표현 진입점. 로직은 game.ts/core가 담당.)
 */
// 폰트 에셋 — self-hosted @fontsource (오프라인 게임: 외부 CDN 비의존).
//   ★우주적 현미경 서체(art-direction-cosmic §3·금지목록 F2): JetBrains/Inter/IBM Plex
//    ("개발자 디폴트 삼종" = AI 중앙값 신호) 폐기. 연구자의 손·천문 카탈로그 톤으로 교체:
//    수치=Spline Sans Mono(약간 인간적인 모노), 본문=Public Sans(휴머니스트 산세),
//    내러티브=Newsreader(라이트 세리프). 한글 글리프는 Gothic A1(라틴 후보엔 한글 없음).
import '@fontsource/spline-sans-mono/400.css';
import '@fontsource/spline-sans-mono/500.css';
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/500.css';
// Gothic A1 — 한글 글리프는 별도 subset(korean-*). 기본 400.css는 latin만 → korean subset 명시 import.
import '@fontsource/gothic-a1/korean-400.css';
import '@fontsource/gothic-a1/korean-500.css';
import './ui/tokens.css'; // 디자인 토큰을 :root에 주입(폰트 로드 후).
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Mount target #app not found.');
}

const app = new App({ target });

export default app;
