/**
 * ui/stores/prefs — 기기 환경설정(사운드·모션). **세이브 봉투와 분리** — localStorage 별도 키.
 *
 *  왜 세이브 밖인가: 음량/뮤트/모션은 *기기* 취향이지 진행 상태가 아니다. export/import(기기 이전)에
 *  실려 다니면 안 되고(§account-sync 취지), 세이브 마이그레이션도 유발하지 않는다. notation/colorblind는
 *  진행과 함께 보존할 이유가 있어 세이브(SettingsState)에 남긴다 — 관심사 분리.
 *
 *  모션: 'auto'=OS(prefers-reduced-motion) 추종 / 'reduce'=항상 최소.
 *   ★접근성 원칙(accessibility §2-B): **OS 감소 요청은 의료적 필요일 수 있어 언제나 이긴다.** 사용자가
 *   'auto'여도 OS가 reduce면 감소. 'reduce'는 OS 미요청 시에도 사용자가 추가로 감소를 켬(더 엄격은 허용,
 *   덜 엄격=OS 감소를 전체로 되돌리기는 불허). → effective = OS감소 OR 사용자'reduce'.
 */
import { writable, derived, type Readable } from 'svelte/store';
import { reducedMotion as osReducedMotion } from './reduced-motion';

export type MotionPref = 'auto' | 'reduce';
/** 위젯 장면 — 'world'=현재 층 세계(게임과 동기화, 기본) / 'cosmic'=우주 사이클(별도 은유). */
export type WidgetScene = 'world' | 'cosmic';

export interface Prefs {
  /** 사운드 뮤트. */
  muted: boolean;
  /** 마스터 볼륨 0..1. */
  volume: number;
  /** 모션 정책. */
  motion: MotionPref;
  /** 앰비언트 사운드스케이프 on/off(SFX와 별개, audio-design §4-3). */
  ambient: boolean;
  /** 위젯 장면(기기 취향 — 세이브 밖). */
  widgetScene: WidgetScene;
}

const KEY = 'micro_idle_prefs';

const DEFAULTS: Prefs = { muted: false, volume: 0.7, motion: 'auto', ambient: true, widgetScene: 'world' };

function load(): Prefs {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULTS.muted,
      volume:
        typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1
          ? parsed.volume
          : DEFAULTS.volume,
      motion: parsed.motion === 'reduce' ? 'reduce' : DEFAULTS.motion,
      ambient: typeof parsed.ambient === 'boolean' ? parsed.ambient : DEFAULTS.ambient,
      widgetScene: parsed.widgetScene === 'cosmic' ? 'cosmic' : DEFAULTS.widgetScene,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export const prefs = writable<Prefs>(load());

// 변경마다 영속화(기기 로컬).
prefs.subscribe((p) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // 저장 실패(프라이빗 모드 등)는 치명이 아님 — 세션 내 값은 유지.
  }
});

/**
 * 렌더러가 구독하는 최종 모션 감쇠 여부 = **OS 감소 OR 사용자 'reduce'.**
 *  OS 감소 요청이 언제나 이긴다(accessibility §2-B, 의료적 필요). 사용자는 감소를 *더* 켤 수만 있고
 *  OS 감소를 전체로 되돌릴 수는 없다.
 */
export const effectiveReducedMotion: Readable<boolean> = derived(
  [prefs, osReducedMotion],
  ([$prefs, $os]) => $os || $prefs.motion === 'reduce',
);

// 개별 필드 업데이트 헬퍼(뷰에서 편하게).
export function setMuted(muted: boolean): void {
  prefs.update((p) => ({ ...p, muted }));
}
export function setVolume(volume: number): void {
  prefs.update((p) => ({ ...p, volume: Math.max(0, Math.min(1, volume)) }));
}
export function setMotion(motion: MotionPref): void {
  prefs.update((p) => ({ ...p, motion }));
}
export function setAmbient(ambient: boolean): void {
  prefs.update((p) => ({ ...p, ambient }));
}
export function setWidgetScene(widgetScene: WidgetScene): void {
  prefs.update((p) => ({ ...p, widgetScene }));
}
