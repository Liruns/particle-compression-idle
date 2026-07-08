/**
 * audio — 절차적 사운드(에셋 0, WebAudio). roadmap M2.4 "사운드 1차".
 *  이벤트 버스 구독으로 능동 액션·마일스톤에 청각 피드백. 로직·경제 불변(읽기 전용 구독).
 *  권위 설계: `design/audio-design.md`(침묵 기반 · 층 색온도↔음역 · 절제).
 */
export { AudioEngine, type AudioEngineOptions } from './engine';
export { voiceForEvent, layerBaseFreq, type VoiceSpec, type VoiceContext } from './voices';
