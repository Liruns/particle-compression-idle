<script lang="ts">
  /**
   * Icon — 계측기 라인 아이콘 래퍼 (visual-overhaul-plan §3-B). 인라인 SVG 컴포넌트(아이콘 폰트 아님).
   *  stroke="currentColor" → 부모가 color로 색을 100% 통제(이모지 폴백 영구 제거, §3-A).
   *  viewBox 0 0 24 24·stroke-width 1.75·라운드 캡/조인 고정(§3-C). path는 paths.ts에서.
   *
   *  접근성(§3-E): label 있으면 role="img"+aria-label(단독 의미), 없으면 aria-hidden(텍스트 동반 장식).
   *  사용: <span style="color:var(--energy)"><Icon name="energy" /></span> — 기존 res-icon 색 패턴 그대로.
   */
  import { ICON_PATHS } from './paths';

  /** 아이콘 키(paths.ts). */
  export let name: string;
  /** px 크기(정사각). 자원 행 등 본문 16, 보조 14. */
  export let size = 16;
  /** 접근 라벨. 있으면 의미 아이콘(role=img), 없으면 장식(aria-hidden). */
  export let label = '';

  $: d = ICON_PATHS[name] ?? '';
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label || undefined}
  aria-hidden={label ? undefined : 'true'}
>
  {@html d}
</svg>

<style>
  /* 인라인 흐름에서 베이스라인 정렬 보정(텍스트 옆 수직 중심). 동물원 베이스라인 종결(§1-C). */
  .icon {
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
  }
</style>
