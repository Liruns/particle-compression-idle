<script context="module" lang="ts">
  /** 토스트 종류 — 스타일 분기. (type export는 모듈 컨텍스트에 둔다 — Svelte 규칙.) */
  export type ToastKind = 'discover' | 'beat' | 'legendary';
</script>

<script lang="ts">
  /**
   * Toast — 우상단 알림(ui-flow §11-B). 발견("[입자] — 도감에 기록됨")·층 진입 비트.
   *  동시 최대 cap개(기본 3). 큐 자동 만료(2~3.6s). 단방향: 부모가 push()로 추가.
   *  층 진입 비트는 여러 줄(narrative §4) — multiline 토스트 허용.
   */
  import { onDestroy } from 'svelte';

  interface ToastItem {
    id: number;
    kind: ToastKind;
    lines: string[];
  }

  let items: ToastItem[] = [];
  let nextId = 0;
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  /** 동시 표시 cap(ui-flow §11-C). */
  const CAP = 3;

  /** 외부(App)에서 호출: 토스트 추가. */
  export function push(kind: ToastKind, lines: string[]): void {
    const id = nextId++;
    items = [...items, { id, kind, lines }].slice(-CAP);
    // 비트(여러 줄)는 길게, 발견은 짧게.
    const ttl = kind === 'beat' ? 4200 : kind === 'legendary' ? 3600 : 2200;
    timers.set(
      id,
      setTimeout(() => dismiss(id), ttl),
    );
  }

  function dismiss(id: number): void {
    items = items.filter((t) => t.id !== id);
    const tm = timers.get(id);
    if (tm) {
      clearTimeout(tm);
      timers.delete(id);
    }
  }

  onDestroy(() => {
    for (const tm of timers.values()) clearTimeout(tm);
    timers.clear();
  });
</script>

<div class="toast-stack" aria-live="polite">
  {#each items as t (t.id)}
    <div class="toast toast-{t.kind}" role="status">
      {#each t.lines as line}
        <span class="toast-line">{line}</span>
      {/each}
    </div>
  {/each}
</div>

<style>
  /* 공허 토스트(§3-A 카드 폐기): 테두리·배경 없는 발광 텍스트를 상단 중앙에 — 자원 성표(우상)·
     결속모드(좌상)와 충돌 없게. 위계는 빛(색)으로(§3-C): 발견=흐린 보라·비트=물러난 흰·전설=옅은 금. */
  .toast-stack {
    position: fixed;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    /* z-8: 게임판(0)·주석(2) 위, 단 bloom 백드롭(9)·팝업(10) 아래 — 팝업 열리면 토스트가 그 뒤로 가림. */
    z-index: 8;
    pointer-events: none;
    max-width: 72vw;
    text-align: center;
  }
  /* 좁은 화면: 상단 주석 띠(결속·자원 성표)와 겹치지 않게 아래로 내리고 폭 확보. */
  @media (max-width: 600px) {
    .toast-stack {
      top: 86px;
      max-width: 92vw;
    }
    .toast-line {
      font-size: 11px;
    }
  }
  .toast {
    padding: 2px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-shadow:
      0 0 14px rgba(0, 0, 0, 0.95),
      0 0 4px rgba(0, 0, 0, 0.9);
    animation: toast-in var(--motion-toast-slide) ease-out;
  }
  .toast-line {
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: rgba(202, 214, 222, 0.82);
    letter-spacing: 0.02em;
    line-height: 1.5;
  }
  .toast-discover .toast-line {
    color: rgba(154, 143, 192, 0.78); /* 흐린 보라(발견 데이터) */
  }
  .toast-beat .toast-line {
    color: rgba(210, 222, 230, 0.85);
  }
  .toast-legendary .toast-line {
    color: rgba(216, 196, 137, 0.92); /* 옅은 금(전설) */
  }

  @keyframes toast-in {
    from {
      transform: translateY(-6px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
