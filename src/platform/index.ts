/**
 * platform — 빌드 타깃 분기: 웹 vs NW.js / Steam 연동 격리. (tech-architecture.md §5.2·§5.3)
 *
 * "연동 코드는 platform/에 격리: 게임 로직은 Steam API를 직접 부르지 않고 **추상 인터페이스**로만 호출.
 *  웹 빌드에선 이 인터페이스가 no-op. → 웹 우선 개발이 Steam 의존으로 오염되지 않고,
 *  Steam 이식이 게임 로직을 안 건드림."
 *
 * 업적 ↔ 도감/상전이 매핑(§5.2): codex 발견·상전이 이벤트(events.ts)를 구독해 Steam 업적으로 변환.
 *   게임 코어는 Steam을 모른다.
 *
 * 1일차: 추상 인터페이스(PlatformAdapter) + 웹 no-op 구현을 둔다. NW.js+steamworks.js 구현은 M3.7.
 *   StorageAdapter 선택(웹=localStorage / Steam=fs)도 이 레이어가 부팅 시 결정(§1.6).
 */

import type { StorageAdapter } from '../core/save/adapters';
import { LocalStorageAdapter } from '../core/save/adapters';

/** 플랫폼 추상 인터페이스. 게임 코어는 이것만 호출(§5.2). */
export interface PlatformAdapter {
  readonly kind: 'web' | 'steam';
  /** 적합한 저장 어댑터 제공(웹=localStorage / Steam=fs, §1.6). */
  createStorageAdapter(): StorageAdapter;
  /** Steam 업적 해금 요청(웹=no-op). */
  unlockAchievement(id: string): void;
  /** Steam 오버레이/Cloud 초기화(웹=no-op). */
  init(): Promise<void>;
}

/** 웹 빌드(itch.io 등). Steam 호출은 전부 no-op(§5.2). */
export class WebPlatform implements PlatformAdapter {
  readonly kind = 'web' as const;

  createStorageAdapter(): StorageAdapter {
    // §1.5: localStorage 기본. (불가 시 IndexedDB fallback은 후속.)
    return new LocalStorageAdapter();
  }

  unlockAchievement(_id: string): void {
    // 웹: no-op. (Steam 빌드에서만 실제 해금.)
  }

  async init(): Promise<void> {
    // 웹: 초기화할 네이티브 연동 없음.
  }
}

// TODO(M3.7): SteamPlatform — NW.js fs StorageAdapter + steamworks.js 업적/오버레이/Cloud.

/**
 * 현재 빌드의 플랫폼 어댑터 선택(부팅 시 주입, §5.3).
 * NW.js 런타임 감지(window.nw 등)로 분기 — 지금은 웹 고정.
 */
export function detectPlatform(): PlatformAdapter {
  // TODO(M3.7): typeof (globalThis as any).nw !== 'undefined' → SteamPlatform
  return new WebPlatform();
}
