<script lang="ts">
  /**
   * SettingsView — 설정(개입 bloom 오버레이). 죽어있던 설정을 UI로 잇는 콘솔:
   *   사운드(뮤트·볼륨) · 모션(auto/최소/전체) · 표기법(과학/공학/표준) · 세이브(내보내기·가져오기·초기화).
   *
   *  관심사 분리:
   *   - 사운드/모션 = 기기 취향 → prefs 스토어(localStorage, 세이브 밖). 여기서 직접 스토어 조작.
   *   - 표기법 = 진행과 함께 보존 → game.setNotation 위임(SettingsState, 세이브 안).
   *   - 세이브 export/import/reset = game 위임(F1 봉투). import 실패는 검증 예외 → 인라인 오류.
   */
  import type { NotationKind } from '../core/format';
  import { prefs, setMuted, setVolume, setMotion, setAmbient, setWidgetScene, type MotionPref } from './stores/prefs';

  /** 현재 표기법(스냅샷). 활성 표시용. */
  export let notation: NotationKind;
  /** 표기법 변경 위임(→ game.setNotation). */
  export let onNotation: (n: NotationKind) => void;
  /** 현재 상태를 export 문자열로(→ game.exportSave). */
  export let onExport: () => string;
  /** import 문자열 적용(→ game.importSave). 실패 시 throw. */
  export let onImport: (raw: string) => void;
  /** 하드 리셋(→ game.resetToFresh). */
  export let onReset: () => void;
  /** 위젯 모드로 전환(→ App.switchWidgetMode — 웹은 같은 탭 URL, Tauri는 창 변형+리로드). */
  export let onWidget: () => void;

  const motionOpts: { id: MotionPref; label: string }[] = [
    { id: 'auto', label: '자동' },
    { id: 'reduce', label: '감소' },
  ];
  const notationOpts: { id: NotationKind; label: string }[] = [
    { id: 'scientific', label: '과학' },
    { id: 'engineering', label: '공학' },
    { id: 'standard', label: '표준' },
    { id: 'logarithm', label: '로그' },
  ];

  // 세이브 데이터 UI 상태.
  let exportText = '';
  let importText = '';
  let importMsg = '';
  let importErr = false;
  let copyMsg = '';
  let confirmReset = false;

  function doExport(): void {
    exportText = onExport();
    copyMsg = '';
    // 클립보드 복사 시도(비동기 — 실패해도 텍스트는 노출됨).
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(exportText).then(
        () => (copyMsg = '클립보드에 복사됨'),
        () => (copyMsg = '아래 텍스트를 직접 복사하세요'),
      );
    } else {
      copyMsg = '아래 텍스트를 직접 복사하세요';
    }
  }

  function doImport(): void {
    const raw = importText.trim();
    if (!raw) {
      importErr = true;
      importMsg = '붙여넣은 세이브가 없습니다.';
      return;
    }
    try {
      onImport(raw);
      importErr = false;
      importMsg = '세이브를 불러왔습니다.';
      importText = '';
    } catch (e) {
      importErr = true;
      importMsg = `가져오기 실패 — ${e instanceof Error ? e.message : '알 수 없는 오류'}`;
    }
  }

  function doReset(): void {
    if (!confirmReset) {
      confirmReset = true;
      return;
    }
    confirmReset = false;
    onReset();
  }

</script>

<div class="settings">
  <h2 class="s-title">설정</h2>

  <!-- 사운드 -->
  <section class="s-group">
    <div class="s-row">
      <span class="s-label">사운드</span>
      <button
        class="s-toggle"
        class:on={!$prefs.muted}
        aria-pressed={!$prefs.muted}
        on:click={() => setMuted(!$prefs.muted)}>{$prefs.muted ? '음소거' : '켜짐'}</button>
    </div>
    <div class="s-row">
      <span class="s-sublabel">볼륨</span>
      <input
        class="s-slider"
        type="range"
        min="0"
        max="100"
        value={Math.round($prefs.volume * 100)}
        disabled={$prefs.muted}
        aria-label="볼륨"
        on:input={(e) => setVolume(+e.currentTarget.value / 100)} />
      <span class="s-value">{Math.round($prefs.volume * 100)}</span>
    </div>
    <div class="s-row">
      <span class="s-sublabel">앰비언트</span>
      <button
        class="s-toggle"
        class:on={$prefs.ambient}
        aria-pressed={$prefs.ambient}
        disabled={$prefs.muted}
        on:click={() => setAmbient(!$prefs.ambient)}>{$prefs.ambient ? '켜짐' : '꺼짐'}</button>
    </div>
  </section>

  <!-- 모션 -->
  <section class="s-group">
    <div class="s-row">
      <span class="s-label">모션</span>
      <div class="s-seg" role="radiogroup" aria-label="모션">
        {#each motionOpts as o}
          <button
            class="seg"
            class:on={$prefs.motion === o.id}
            role="radio"
            aria-checked={$prefs.motion === o.id}
            on:click={() => setMotion(o.id)}>{o.label}</button>
        {/each}
      </div>
    </div>
    <p class="s-hint">감소 = 파티클·맥동 정지(접근성). 자동은 OS 설정을 따르며, OS가 감소를 요청하면 항상 감소합니다.</p>
  </section>

  <!-- 표기법 -->
  <section class="s-group">
    <div class="s-row">
      <span class="s-label">숫자 표기</span>
      <div class="s-seg" role="radiogroup" aria-label="숫자 표기법">
        {#each notationOpts as o}
          <button
            class="seg"
            class:on={notation === o.id}
            role="radio"
            aria-checked={notation === o.id}
            on:click={() => onNotation(o.id)}>{o.label}</button>
        {/each}
      </div>
    </div>
    <p class="s-hint">과학 1.23×10²³ · 공학 1.23e+24 · 표준 1.23M · 로그 e23.09</p>
  </section>

  <!-- 위젯 모드 -->
  <section class="s-group">
    <div class="s-row">
      <span class="s-label">위젯 모드</span>
      <button class="s-btn" on:click={onWidget}>위젯으로 전환</button>
    </div>
    <div class="s-row">
      <span class="s-sublabel">위젯 장면</span>
      <div class="s-seg" role="radiogroup" aria-label="위젯 장면">
        <button
          class="seg"
          class:on={$prefs.widgetScene === 'world'}
          role="radio"
          aria-checked={$prefs.widgetScene === 'world'}
          on:click={() => setWidgetScene('world')}>게임 세계</button>
        <button
          class="seg"
          class:on={$prefs.widgetScene === 'cosmic'}
          role="radio"
          aria-checked={$prefs.widgetScene === 'cosmic'}
          on:click={() => setWidgetScene('cosmic')}>우주 사이클</button>
      </div>
    </div>
    <p class="s-hint">
      게임 UI를 숨기고 관조합니다. <b>게임 세계</b>(기본) = 지금 있는 층의 세계를 그대로 비춥니다(게임과 동기화).
      <b>우주 사이클</b> = 진행도가 원자→은하→블랙홀로 자라는 별도 장면. 진행·자동 생산은 계속됩니다.
      Esc로 돌아옵니다. 데스크톱 앱에선 위젯이 기본 화면입니다(첫 실행만 게임 화면 — 온보딩).
    </p>
  </section>

  <!-- 세이브 데이터 -->
  <section class="s-group">
    <span class="s-label">세이브 데이터</span>
    <div class="s-save-btns">
      <button class="s-btn" on:click={doExport}>내보내기</button>
    </div>
    {#if exportText}
      <textarea class="s-text" readonly rows="3" aria-label="내보낸 세이브">{exportText}</textarea>
      {#if copyMsg}<p class="s-msg">{copyMsg}</p>{/if}
    {/if}

    <div class="s-import">
      <textarea
        class="s-text"
        rows="3"
        placeholder="세이브 문자열을 붙여넣고 가져오기"
        bind:value={importText}
        aria-label="가져올 세이브"></textarea>
      <button class="s-btn" on:click={doImport}>가져오기</button>
      {#if importMsg}<p class="s-msg" class:err={importErr}>{importMsg}</p>{/if}
    </div>

    <div class="s-danger">
      <button class="s-btn danger" class:armed={confirmReset} on:click={doReset}>
        {confirmReset ? '정말 초기화? (다시 눌러 확인)' : '처음부터 새로 시작'}
      </button>
      {#if confirmReset}
        <button class="s-btn ghost" on:click={() => (confirmReset = false)}>취소</button>
      {/if}
      <p class="s-hint">모든 진행이 지워집니다. 먼저 내보내기로 백업하세요.</p>
    </div>
  </section>
</div>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: 18px;
    color: var(--foreground);
  }
  .s-title {
    margin: 0;
    font-family: var(--font-label);
    font-size: var(--text-label-lg, 16px);
    font-weight: 600;
    color: var(--foreground);
  }
  .s-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 14px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
  }
  .s-group:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  .s-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .s-label {
    font-family: var(--font-label);
    font-size: var(--text-label-md, 14px);
    color: var(--foreground);
  }
  .s-sublabel {
    font-family: var(--font-label);
    font-size: var(--text-label-sm, 12px);
    color: var(--foreground-sub);
  }
  .s-hint {
    margin: 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm, 12px);
    color: var(--foreground-dim);
  }

  /* 토글(사운드 on/off) — 조용한 알약. */
  .s-toggle {
    font-family: var(--font-label);
    font-size: var(--text-label-sm, 12px);
    color: var(--foreground-dim);
    background: none;
    border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    border-radius: 999px;
    padding: 5px 14px;
    cursor: pointer;
    transition:
      color 0.2s ease,
      border-color 0.2s ease,
      background 0.2s ease;
  }
  .s-toggle.on {
    color: var(--qf);
    border-color: color-mix(in srgb, var(--qf) 45%, transparent);
    background: color-mix(in srgb, var(--qf) 8%, transparent);
  }

  /* 볼륨 슬라이더. */
  .s-slider {
    flex: 1;
    accent-color: var(--energy);
    cursor: pointer;
  }
  .s-slider:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .s-value {
    font-family: var(--font-numeric);
    font-size: var(--text-num-sm, 12px);
    color: var(--foreground-sub);
    min-width: 26px;
    text-align: right;
  }

  /* 세그먼트(모션·표기법). */
  .s-seg {
    display: inline-flex;
    gap: 2px;
    background: color-mix(in srgb, var(--surface) 60%, transparent);
    border-radius: 999px;
    padding: 2px;
  }
  .seg {
    font-family: var(--font-label);
    font-size: var(--text-label-sm, 12px);
    color: var(--foreground-dim);
    background: none;
    border: none;
    border-radius: 999px;
    padding: 5px 12px;
    cursor: pointer;
    transition:
      color 0.2s ease,
      background 0.2s ease;
  }
  .seg.on {
    color: var(--canvas, #06070d);
    background: color-mix(in srgb, var(--primary) 82%, transparent);
  }

  /* 세이브 버튼·텍스트. */
  .s-save-btns,
  .s-import,
  .s-danger {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .s-import {
    margin-top: 4px;
  }
  .s-btn {
    align-self: flex-start;
    font-family: var(--font-label);
    font-size: var(--text-label-sm, 12px);
    color: var(--foreground-sub);
    background: color-mix(in srgb, var(--surface) 70%, transparent);
    border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    border-radius: 8px;
    padding: 7px 14px;
    cursor: pointer;
    transition:
      color 0.2s ease,
      border-color 0.2s ease,
      background 0.2s ease;
  }
  .s-btn:hover {
    color: var(--foreground);
    border-color: color-mix(in srgb, var(--primary) 40%, transparent);
  }
  .s-btn.danger {
    color: var(--col-reset, #c08a8a);
    border-color: color-mix(in srgb, var(--col-reset, #c08a8a) 35%, transparent);
  }
  .s-btn.danger.armed {
    background: color-mix(in srgb, var(--col-reset, #c08a8a) 14%, transparent);
    color: var(--foreground);
  }
  .s-btn.ghost {
    color: var(--foreground-dim);
  }
  .s-text {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-numeric);
    font-size: 11px;
    color: var(--foreground-sub);
    background: color-mix(in srgb, var(--canvas, #06070d) 80%, transparent);
    border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    border-radius: 8px;
    padding: 8px;
    resize: vertical;
    word-break: break-all;
  }
  .s-msg {
    margin: 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm, 12px);
    color: var(--qf);
  }
  .s-msg.err {
    color: var(--col-reset, #c08a8a);
  }
</style>
