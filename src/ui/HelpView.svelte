<script lang="ts">
  /**
   * HelpView — 관측 안내(도움말, 개입 bloom 오버레이). 다이제틱 공허 UI는 라벨 버튼이 없어
   *  조작이 암묵적이다. mechIntro 토스트는 순간적이라 놓치면 참조가 없다 → 언제든 부르는 상설 참조.
   *  강요 아님(리서치 "필요할 때 제공") — dock 안내 노드/? 키로 연다. 로직 비관여(표시 전용).
   */

  interface Row {
    key: string;
    desc: string;
  }
  const controls: Row[] = [
    { key: '물질(세포) 만지기·드래그', desc: '압축 — E·C 획득 (스페이스 키도 가능)' },
    { key: '궤도 껍질 누르기', desc: '결속(압축기 구매) — 자동 생산 가속' },
    { key: '공명 전자(밝을 때) 누르기', desc: '오비탈 공명 — 배율↑·데이터 획득 (원자~쿼크층)' },
    { key: '위상 노드 누르기', desc: '상태 고정/해제 — 응집·분산·공명 선택 (프리온층+)' },
    { key: '하단 노드', desc: '장치(연구·도감·상전이) · 도구(기록·목표·설정·안내·저장) — 부르면 피어남' },
  ];
  const keys: Row[] = [
    { key: '스페이스', desc: '압축' },
    { key: '1 · 2 · 3 · 4', desc: '결속 수량 ×1 · ×10 · ×100 · 최대' },
    { key: 'R · C · P', desc: '연구 · 도감 · 상전이 (노드가 떠 있을 때)' },
    { key: 'T · A · S · H', desc: '기록 · 목표 · 설정 · 안내' },
    { key: 'Esc', desc: '열린 패널 닫기 (위젯에선 게임 화면 복귀)' },
    { key: '?', desc: '이 안내 열기/닫기' },
  ];
  const resources: Row[] = [
    { key: 'E · 압축 에너지', desc: '압축기 체인이 생산 — 결속(구매) 비용' },
    { key: 'C · 압축 깊이', desc: '반경 r을 줄인다 — 작아질수록 강해진다' },
    { key: 'D · 발견 데이터', desc: '능동 메커니즘이 산출 — 연구 화폐' },
    { key: 'QF · 양자 거품', desc: '상전이로 획득 — 영구 생산 배율' },
  ];
  const mechanisms: Row[] = [
    { key: '오비탈 공명 (원자~쿼크)', desc: '궤도를 도는 전자가 밝아질 때 만져 공명 — 놓쳐도 방치 진행' },
    { key: '위상 겹침 (프리온+)', desc: '세 상태 노드 중 하나를 고정 — 무엇을 우선할지 선택' },
    { key: '진동 하모닉스 (끈+)', desc: '충전이 차면 티어 껍질이 공명 — 지켜보는 메커니즘' },
  ];
</script>

<div class="help">
  <h2 class="h-title">관측 안내</h2>
  <p class="h-lead">공허가 곧 게임판이다. 평소엔 지켜보고(관조), 손을 뻗어 만진다(개입).</p>

  <section class="h-group">
    <h3 class="h-cat">조작</h3>
    <ul class="h-list" role="list">
      {#each controls as r}
        <li class="h-row"><span class="h-key">{r.key}</span><span class="h-desc">{r.desc}</span></li>
      {/each}
    </ul>
  </section>

  <section class="h-group">
    <h3 class="h-cat">키보드</h3>
    <ul class="h-list" role="list">
      {#each keys as r}
        <li class="h-row"><span class="h-key mono">{r.key}</span><span class="h-desc">{r.desc}</span></li>
      {/each}
    </ul>
  </section>

  <section class="h-group">
    <h3 class="h-cat">자원</h3>
    <ul class="h-list" role="list">
      {#each resources as r}
        <li class="h-row"><span class="h-key">{r.key}</span><span class="h-desc">{r.desc}</span></li>
      {/each}
    </ul>
  </section>

  <section class="h-group">
    <h3 class="h-cat">능동 메커니즘 (층마다 새로움)</h3>
    <ul class="h-list" role="list">
      {#each mechanisms as r}
        <li class="h-row"><span class="h-key">{r.key}</span><span class="h-desc">{r.desc}</span></li>
      {/each}
    </ul>
  </section>

  <section class="h-group">
    <h3 class="h-cat">위젯 모드</h3>
    <ul class="h-list" role="list">
      <li class="h-row"><span class="h-key">설정 → 위젯으로 전환</span><span class="h-desc">게임 UI를 숨기고 관조 — 기본은 지금 층의 세계 그대로(동기화), 설정에서 우주 사이클로 변경 가능</span></li>
      <li class="h-row"><span class="h-key">위젯에서 클릭</span><span class="h-desc">잔물결(장난감 — 보상 없음)</span></li>
      <li class="h-row"><span class="h-key">위젯 → 게임 복귀</span><span class="h-desc">Esc (웹·데스크톱 공통) · 데스크톱은 트레이 "게임 ↔ 위젯 전환"도 가능</span></li>
      <li class="h-row"><span class="h-key">데스크톱 앱</span><span class="h-desc">투명 위젯 창이 기본 — 드래그로 이동, 트레이에서 보이기/숨기기. 게임 모드로 나가면 일반 창(테두리·태스크바)으로 변형</span></li>
    </ul>
  </section>

  <p class="h-note">방치도 보상, 개입도 보상. 안 만져도 진행하고, 만지면 가속한다.</p>
</div>

<style>
  .help {
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: var(--foreground);
  }
  .h-title {
    margin: 0;
    font-family: var(--font-label);
    font-size: var(--text-label-lg, 16px);
    font-weight: 600;
    color: var(--foreground);
  }
  .h-lead {
    margin: 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm, 13px);
    color: var(--foreground-sub);
  }
  .h-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .h-cat {
    margin: 0;
    font-family: var(--font-label);
    font-size: var(--text-label-sm, 12px);
    letter-spacing: 0.08em;
    color: var(--foreground-sub);
  }
  .h-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .h-row {
    display: grid;
    grid-template-columns: minmax(120px, 40%) 1fr;
    align-items: baseline;
    gap: 12px;
    padding: 6px 2px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 30%, transparent);
  }
  .h-row:last-child {
    border-bottom: none;
  }
  .h-key {
    font-family: var(--font-label);
    font-size: var(--text-label-sm, 12px);
    color: var(--foreground);
  }
  .h-key.mono {
    font-family: var(--font-numeric);
    color: var(--energy, #d9b86a);
  }
  .h-desc {
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm, 12px);
    color: var(--foreground-sub);
  }
  .h-note {
    margin: 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm, 12px);
    color: var(--foreground-dim);
  }
</style>
