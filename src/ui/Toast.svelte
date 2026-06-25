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
  .toast-stack {
    position: fixed;
    top: var(--space-md);
    right: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    z-index: 50;
    pointer-events: none;
    max-width: 320px;
  }
  .toast {
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 2px solid var(--layer-accent);
    border-radius: var(--rounded-md);
    padding: var(--space-sm) var(--space-base);
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    animation: toast-in var(--motion-toast-slide) ease-out;
  }
  .toast-line {
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground);
    line-height: 1.5;
  }
  .toast-discover {
    border-left-color: var(--data);
  }
  .toast-discover .toast-line {
    color: var(--foreground-sub);
  }
  .toast-beat {
    border-left-color: var(--layer-accent);
  }
  .toast-legendary {
    border-left-color: var(--legendary);
  }
  .toast-legendary .toast-line {
    color: var(--legendary);
  }

  @keyframes toast-in {
    from {
      transform: translateX(12px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
