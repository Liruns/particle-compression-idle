<script lang="ts">
  /**
   * RightPanelStatus — 우측 패널 하단 상태 요약. (layout-visual-study §3 P0-4 / ui-flow §2-A)
   *  우측 컬럼의 "사고난 빈 공간"(D3)을 ui-flow §2-A 설계대로 콘텐츠로 채운다:
   *   - 도감 미니 진행: 알려진 물리 층별 n/전체 작은 바 + 총 수집 헤드.
   *   - 연구 가지 현황 1줄(해금 시).
   *   - 상전이 힌트(조건 충족 시만).
   *   - 하단 고정 "더 작은 것이 있다."(재하강 후 톤, 항상 우하단 앵커).
   *  단방향: 스냅샷 파생만 읽어 표시(읽기 전용). 클릭/이동 없음(요약 전용).
   */
  import type { CodexSnapshot, PrestigeSnapshot, GameSnapshot } from '../game';

  export let codex: CodexSnapshot;
  /** 연구 스냅샷(타입은 snapshot 인덱스 접근 — ResearchView는 컴포넌트명과 충돌·미재export). */
  export let research: GameSnapshot['research'];
  export let prestige: PrestigeSnapshot;
  /** 도감 첫 발견 전이면 도감 미니 진행 숨김(FTUE 정합). */
  export let showCodex = false;

  // 알려진 물리(L1~L5) 층별 완성 현황만(미지 서브층은 도감 탭에서). 발견된 층 위주로 정렬 유지.
  $: knownLayers = (codex.layerCompletions ?? []).filter((l) => l.layerIndex >= 1 && l.layerIndex <= 5);
  // 연구 가지 진행 [구매, 전체].
  $: rp = research?.branchProgress ?? [0, 0];
</script>

<div class="rps">
  {#if showCodex && knownLayers.length > 0}
    <section class="blk codex" aria-label="도감 진행">
      <div class="blk-head">
        <span class="blk-title">도감</span>
        <span class="blk-count">{codex.collected}<span class="den">/{codex.denominator}</span></span>
      </div>
      <ul class="mini" role="list">
        {#each knownLayers as l (l.layerIndex)}
          {@const frac = l.total > 0 ? l.collected / l.total : 0}
          <li class="mini-row" class:done={l.collected >= l.total && l.total > 0}>
            <span class="mini-lbl">L{l.layerIndex}</span>
            <span class="mini-bar"><span class="mini-fill" style="width:{Math.round(frac * 100)}%"></span></span>
            <span class="mini-n">{l.collected}/{l.total}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if research?.unlocked}
    <section class="blk" aria-label="연구 현황">
      <div class="line">
        <span class="line-lbl">연구 · 체인 증폭</span>
        <span class="line-val">{rp[0]}<span class="den">/{rp[1]}</span></span>
      </div>
    </section>
  {/if}

  {#if prestige?.available}
    <section class="blk hint" aria-label="상전이 힌트">
      <span class="hint-dot" aria-hidden="true"></span>
      <div class="hint-body">
        <span class="hint-lbl">{prestige.isFirst ? '미지 진입 준비' : '상전이 준비'}</span>
        <span class="hint-sub"
          >{prestige.targetLayerKo || '미지 서브층'} · +{prestige.isFirst ? '첫 ' : ''}QF</span>
      </div>
    </section>
  {/if}

  <p class="whisper">더 작은 것이 있다.</p>
</div>

<style>
  .rps {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    width: 100%;
  }
  .blk {
    background: var(--canvas-layer);
    border: 1px solid var(--border);
    border-radius: var(--rounded-md);
    padding: var(--space-sm) var(--space-base);
  }
  .blk-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: var(--space-xs);
  }
  .blk-title {
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
    letter-spacing: 0.04em;
  }
  .blk-count {
    font-family: var(--font-numeric);
    font-size: var(--text-num-md);
    color: var(--data);
  }
  .den {
    color: var(--foreground-dim);
    font-size: var(--text-label-xs);
  }

  /* 도감 미니 진행 — 층별 한 줄: [라벨] [얇은 바] [n/전체]. */
  .mini {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .mini-row {
    display: grid;
    grid-template-columns: 20px 1fr auto;
    align-items: center;
    gap: var(--space-xs);
  }
  .mini-lbl {
    font-family: var(--font-numeric);
    font-size: var(--text-label-xs);
    color: var(--foreground-sub);
  }
  .mini-bar {
    height: 4px;
    border-radius: var(--rounded-sm);
    background: var(--surface);
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .mini-fill {
    display: block;
    height: 100%;
    background: color-mix(in srgb, var(--data) 80%, transparent);
    transition: width var(--motion-fade-cross) ease-out;
  }
  .mini-row.done .mini-fill {
    background: var(--col-keep);
  }
  .mini-n {
    font-family: var(--font-numeric);
    font-size: var(--text-label-xs);
    color: var(--foreground-dim);
    white-space: nowrap;
  }

  /* 연구 1줄. */
  .line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .line-lbl {
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
  }
  .line-val {
    font-family: var(--font-numeric);
    font-size: var(--text-num-md);
    color: var(--foreground);
  }

  /* 상전이 힌트 — 조건 충족 시만. QF 녹 도트 + 2줄. */
  .blk.hint {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    border-color: color-mix(in srgb, var(--qf) 35%, var(--border));
    background: color-mix(in srgb, var(--qf) 6%, var(--canvas-layer));
  }
  .hint-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--rounded-full);
    background: var(--qf);
    box-shadow: 0 0 6px var(--qf);
    flex: 0 0 auto;
  }
  .hint-body {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 0;
  }
  .hint-lbl {
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
    font-weight: 500;
    color: var(--qf);
  }
  .hint-sub {
    font-family: var(--font-narrative);
    font-size: var(--text-label-xs);
    color: var(--foreground-sub);
  }

  /* 하단 고정 앵커 — "더 작은 것이 있다." */
  .whisper {
    margin: var(--space-sm) 0 0;
    text-align: center;
    opacity: 0.45;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
  }
</style>
