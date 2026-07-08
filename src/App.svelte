<script lang="ts">
  /**
   * App.svelte — 다이제틱 공허 게임판 셸 (이관 2단계, cosmic-direction §3·§4).
   *  대시보드(3패널·탭·게이지·체인 테이블)를 폐기하고(§3-A), 화면을 두 레이어로 재구성한다:
   *   ① 풀스크린 게임 캔버스 — WorldRenderer(세계 배경) + BoardRenderer(중심 코어·8 궤도 껍질·세포).
   *   ② 공허에 뜬 희미한 DOM 주석 — 자원 성표(테두리·카드 0), r·층, 힌트, 결속모드, 가장자리 디바이스 노드.
   *
   *  관조 ↔ 개입(§3-B): 평소엔 입자가 떠다니는 것을 지켜보고(관조), 손을 뻗을 때 만진다(개입):
   *   - 세포 만지기 = 압축·흡수(능동, §4 수동 압축) → game.manualCompress().
   *   - 껍질 클릭 = 결속(구매) → game.buy(tier, mode) (E 비용 — 실제 경제 불변).
   *   - 공명 전자/위상 노드 = 능동 메커니즘 직접 조작(§4) — 전부 게임판 위 다이제틱(BoardRenderer).
   *   - 가장자리 노드(연구·도감·상전이) = 잠든 빛 → 부르면 bloom 오버레이(콘텐츠 뷰 재사용).
   *
   *  ★표현만, 로직 0줄(§6·§7-C): 모든 game 호출은 기존 API 그대로. 경제·수식·밸런스 불변.
   *   FTUE 점진 공개·점등 조건·오프라인 복귀 요약(정보 로직 §7-C#3)을 공허 모델로 보존.
   *  ★단방향(§4.1): snapshot 구독→표시. board는 히트테스트만 돌려주고 game 호출은 여기서.
   */
  import { onMount, onDestroy } from 'svelte';
  import { Game, installUnloadSave, type GameSnapshot, type BuyMode } from './game';
  import { formatNumber, formatRadius } from './core/format';
  import { bus } from './core/events';
  import { CanvasRenderer } from './render';
  import type { BoardInput, BoardShell, BoardPhase, BoardHarmonics, BoardPhaseState } from './render/board';
  import { PHASE_OVERLAP } from './data/constants';
  import { prefs, effectiveReducedMotion, type Prefs } from './ui/stores/prefs';
  import { AudioEngine } from './core/audio';
  import type { NotationKind } from './core/format';
  import { particleById } from './data/particles';
  import { layerEntryBeat } from './data/narrative';
  import CodexView from './ui/CodexView.svelte';
  import ResearchView from './ui/ResearchView.svelte';
  import PrestigeView from './ui/PrestigeView.svelte';
  import OfflineModal from './ui/OfflineModal.svelte';
  import SettingsView from './ui/SettingsView.svelte';
  import StatsView from './ui/StatsView.svelte';
  import AchievementsView from './ui/AchievementsView.svelte';
  import HelpView from './ui/HelpView.svelte';
  import { achievementById } from './core/achievements';
  import Toast from './ui/Toast.svelte';

  let snap: GameSnapshot | null = null;
  let game: Game | null = null;
  let unsub: (() => void) | null = null;
  const busUnsubs: (() => void)[] = [];
  let toast: Toast;

  // 풀스크린 게임 캔버스(세계 배경 + 전경 게임판). 글로우 게이지 캔버스는 폐기(null) — 게이지=코어로 대체.
  let bgCanvas: HTMLCanvasElement | null = null;
  let renderer: CanvasRenderer | null = null;
  let lastSlug = '';
  /** 미지 층(index≥6)에 이미 들어와 봤는가 — 첫 진입만 머니샷. 로드 세이브가 미지면 start 후 true. */
  let seenUnknown = false;
  let rmUnsub: (() => void) | null = null;
  let bgResizeObserver: ResizeObserver | null = null;
  let onWindowResize: (() => void) | null = null;

  // 절차적 사운드(M2.4). 첫 포인터/키 제스처에서 unlock(브라우저 자동재생 정책).
  let audio: AudioEngine | null = null;
  let audioUnlocked = false;
  let prefsUnsub: (() => void) | null = null;
  let curPrefs: Prefs = { muted: false, volume: 0.7, motion: 'auto', ambient: true };

  /** 결속(구매) 수량 모드 — 공허 좌상단 셀렉터. */
  let buyMode: BuyMode = 1;
  const buyModes: { id: BuyMode; label: string }[] = [
    { id: 1, label: '×1' },
    { id: 10, label: '×10' },
    { id: 100, label: '×100' },
    { id: 'max', label: '최대' },
  ];

  /** 부른 디바이스(개입 bloom 오버레이). null=관조. */
  type Panel = 'research' | 'codex' | 'prestige' | 'settings' | 'stats' | 'achievements' | 'help';
  let activePanel: Panel | null = null;

  /** 포인터 드래그(누른 채 쓸어담기) 상태. */
  let pointerDown = false;

  /** 현재 층 발광색(QF 성표 = 층색 §3-C). pushRender에서 갱신. */
  let layerRgb = '159,184,154';

  /** 메커니즘 첫 등장 안내(게임판 다이제틱이라 무엇을 할지 1회 안내). 부팅·로드 활성은 발화 안 함. */
  let mechIntroEnabled = false;
  let prevResonance = false;
  let prevPhase = false;
  let prevHarmonics = false;

  /** 업적 토스트 게이트 — 부팅/로드 catch-up 달성(구세이브 다수 동시 달성)은 조용히 흡수. */
  let achievementsReady = false;

  onMount(async () => {
    game = new Game();
    unsub = game.subscribe((s) => {
      snap = s;
      pushRender(s);
    });
    installUnloadSave(game);

    setupRenderer();
    rmUnsub = effectiveReducedMotion.subscribe((v) => renderer?.setReducedMotion(v));

    // 사운드 엔진 — 이벤트 버스 구독(읽기 전용). 층 인덱스로 음역 결정. prefs로 mute/volume 반영.
    audio = new AudioEngine({ getLayerIndex: () => snap?.layer.index ?? 1 });
    audio.bind(bus);
    prefsUnsub = prefs.subscribe((p) => {
      curPrefs = p;
      audio?.setMuted(p.muted);
      audio?.setVolume(p.volume);
      audio?.setAmbientEnabled(p.ambient);
    });

    if (import.meta.env.DEV) {
      (window as unknown as { forceLayer: (slug: string) => void }).forceLayer = (slug: string) => {
        renderer?.onLayerChange(slug);
        lastSlug = slug;
      };
    }

    busUnsubs.push(
      bus.on('codexDiscover', ({ particleId }) => {
        const p = particleById(particleId);
        if (!p) return;
        const kind = p.rarity === 'LEGENDARY' ? 'legendary' : 'discover';
        toast?.push(kind, [`${p.nameKo} — 도감에 기록됨`]);
        // 발견 종소리 — 등급(legendary)은 App만 알기에 직접 cue(엔진 자동구독 제외).
        audio?.cue('codexDiscover', { legendary: kind === 'legendary' });
      }),
    );
    busUnsubs.push(
      bus.on('layerEnter', ({ layer }) => {
        const beat = layerEntryBeat(layer);
        if (beat) toast?.push('beat', beat.lines);
      }),
    );
    busUnsubs.push(
      bus.on('prestige_beat', ({ execLine, beatLines, isFirst }) => {
        const lines = beatLines.length > 0 ? [execLine, ...beatLines] : [execLine];
        toast?.push(isFirst ? 'legendary' : 'beat', lines);
      }),
    );
    busUnsubs.push(
      bus.on('achievement_earned', ({ id }) => {
        if (!achievementsReady) return; // 부팅/로드 catch-up 억제
        const a = achievementById(id);
        if (a) toast?.push('discover', [`관측 목표 달성 — ${a.nameKo}`]);
      }),
    );

    await game.start();
    // 부팅·로드 동안 활성된 메커니즘은 안내 발화 안 함 — 시작 후의 실제 진입 전이만 가르친다.
    if (snap) {
      prevResonance = snap.resonance.active;
      prevPhase = snap.phase.active;
      prevHarmonics = snap.harmonics.active;
    }
    mechIntroEnabled = true;
    achievementsReady = true;
    // 로드된 세이브가 이미 미지 층이면 머니샷 소진 처리(재방문엔 안 뜸). 알려진 물리/새 게임이면 false 유지.
    seenUnknown = (snap?.layer.index ?? 1) >= 6;
    if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
  });

  /** 메커니즘이 처음 활성될 때(inactive→active 전이) 1회 안내. 부팅/로드 후의 실제 진입만. */
  function checkMechIntro(s: GameSnapshot): void {
    if (!mechIntroEnabled) return;
    if (s.resonance.active && !prevResonance)
      toast?.push('beat', ['오비탈 공명 — 궤도를 도는 전자가 밝아질 때 만져 공명하라.']);
    if (s.phase.active && !prevPhase)
      toast?.push('beat', ['위상 겹침 — 세 상태 노드를 만져 고정한다. 무엇을 우선할지 선택하라.']);
    if (s.harmonics.active && !prevHarmonics)
      toast?.push('beat', ['진동 하모닉스 — 충전이 차면 다음 티어 껍질이 공명한다.']);
    prevResonance = s.resonance.active;
    prevPhase = s.phase.active;
    prevHarmonics = s.harmonics.active;
  }
  // snap 갱신마다 전이 검사(저렴 — 전이 시에만 토스트).
  $: if (mechIntroEnabled && snap) checkMechIntro(snap);

  onDestroy(() => {
    unsub?.();
    for (const u of busUnsubs) u();
    rmUnsub?.();
    prefsUnsub?.();
    audio?.dispose();
    if (savedTimer) clearTimeout(savedTimer);
    bgResizeObserver?.disconnect();
    if (onWindowResize) window.removeEventListener('resize', onWindowResize);
    renderer?.dispose();
    game?.dispose();
  });

  // --- 렌더러 와이어링 ----------------------------------------------------------
  function setupRenderer(): void {
    if (!bgCanvas) return;
    // 단일 풀스크린 캔버스(세계 배경 + 전경 게임판 합성). 구 게이지 글로우 캔버스는 폐기됨.
    renderer = new CanvasRenderer({ bgCanvas });
    renderer.setReducedMotion($effectiveReducedMotion);
    if (snap) {
      lastSlug = snap.layer.slug;
      renderer.onLayerChange(snap.layer.slug);
      pushRender(snap);
    }
    if (typeof ResizeObserver !== 'undefined') {
      bgResizeObserver?.disconnect();
      bgResizeObserver = new ResizeObserver(() => renderer?.resize());
      bgResizeObserver.observe(bgCanvas);
    }
    if (typeof window !== 'undefined' && !onWindowResize) {
      onWindowResize = () => renderer?.resize();
      window.addEventListener('resize', onWindowResize);
    }
  }

  /** snapshot → 렌더러(읽기전용 파생). 층 변화 감지 + 게임판 입력 주입 + draw. */
  function pushRender(s: GameSnapshot): void {
    if (!renderer) return;
    if (s.layer.slug !== lastSlug) {
      const first = lastSlug !== ''; // 부팅 첫 슬러그(빈 lastSlug)는 즉시 스냅 — 전환 아님
      lastSlug = s.layer.slug;
      // 머니샷: 미지 층(index≥6)으로 *처음* 넘는 순간(쿼크→프리온 첫 상전이) = 색온도 식는 머니샷(art-cosmic §6).
      const enteringUnknown = s.layer.index >= 6;
      const moneyShot = first && enteringUnknown && !seenUnknown;
      if (enteringUnknown) seenUnknown = true;
      renderer.onLayerChange(s.layer.slug, moneyShot); // 세계·게임판 색은 렌더러가 slug로 직접 구동
      audio?.setLayer(s.layer.index); // 앰비언트 사운드스케이프 층 크로스페이드(사운드 2차)
    }
    renderer.gameBoard.setInput(buildBoardInput(s));
    layerRgb = renderer.layerColorRGB;
    renderer.draw();
  }

  /** snapshot → BoardInput(읽기전용 파생). Decimal→number/string 환산은 여기 경계에서만(V2-8). */
  function buildBoardInput(s: GameSnapshot): BoardInput {
    // 오비탈 공명(원자~쿼크층) — 슬롯 열림 타이밍이 곧 전자 클릭(§4 표 2행).
    const resonance = {
      active: s.resonance.active,
      open: s.resonance.active && s.resonance.phase === 'open',
      progress: s.resonance.progress,
    };
    // 위상 겹침(프리온층+) — 세 상태 노드 직접 조작(§4 표 3행). 배율은 표시 전용 상수(로직 불변).
    //   발견 임계(누적 유지시간): 응집/분산 10s, 공명 20s (PhaseWidget 정보 로직 보존).
    const phase: BoardPhase = {
      active: s.phase.active,
      state: s.phase.state,
      pinned: s.phase.pinned,
      cycleProgress: s.phase.cycleProgress,
      pinCostLabel: formatNumber(s.phase.pinCost, 1),
      nodes: [
        { state: 'coherent', nameKo: '응집', effect: '체인 ↑', mult: PHASE_OVERLAP.COHERENT_MULT, found: s.phase.times.coherent >= 10 },
        { state: 'dispersed', nameKo: '분산', effect: '데이터 ↑', mult: PHASE_OVERLAP.DISPERSED_MULT, found: s.phase.times.dispersed >= 10 },
        { state: 'resonant', nameKo: '공명', effect: '거품 ↑', mult: PHASE_OVERLAP.RESONANT_MULT, found: s.phase.times.resonant >= 20 },
      ],
    };
    // 진동 하모닉스(끈층+) — passive 시각화(클릭 없음, §4 표 4행).
    const harmonics: BoardHarmonics = {
      active: s.harmonics.active,
      chargeProgress: s.harmonics.chargeProgress,
      nextTier: s.harmonics.nextTier,
      burstingTiers: s.harmonics.burstingTiers,
      totalResonances: s.harmonics.totalResonances,
    };
    // 체인 미공개(FTUE)면 껍질 없음 — 관조(코어+세포) + 공명만.
    if (!s.ftue.showChain) {
      return {
        shells: [],
        decadeProgress: s.layer.decadeProgress,
        energyLabel: formatNumber(s.E, 2),
        resonance,
        phase,
        harmonics,
      };
    }
    // 최적(가장 싼 다음 구매) 티어 — 부름 강조.
    let bestTier = -1;
    let bestCost: import('break_eternity.js').default | null = null;
    for (const t of s.tiers) {
      if (!t.unlocked) continue;
      if (bestCost === null || t.nextCost.lt(bestCost)) {
        bestCost = t.nextCost;
        bestTier = t.tier;
      }
    }
    const shells: BoardShell[] = [];
    for (const t of s.tiers) {
      if (!t.unlocked) continue;
      const producing = t.owned.gt(0);
      shells.push({
        tier: t.tier,
        ownedLog10: producing ? t.owned.log10().toNumber() : -1,
        bought: t.bought,
        unlocked: true,
        affordable: t.affordable,
        producing,
        best: t.tier === bestTier,
        nameKo: `T${t.tier} 압축기`,
        costLabel: `결속 −${formatNumber(t.nextCost, 2)} E`,
        rateLabel: producing
          ? `보유 ${formatNumber(t.owned, 0)} · +${formatNumber(t.rate, 2)}/s`
          : '미가동',
      });
    }
    return {
      shells,
      decadeProgress: s.layer.decadeProgress,
      energyLabel: formatNumber(s.E, 2),
      resonance,
      phase,
      harmonics,
    };
  }

  // --- 포인터 상호작용(공허에 손 뻗기) ------------------------------------------
  function canvasXY(e: PointerEvent): { x: number; y: number } {
    const rect = bgCanvas!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: PointerEvent): void {
    if (!renderer || !game || !snap || e.button !== 0) return;
    unlockAudio();
    pointerDown = true;
    const { x, y } = canvasXY(e);
    renderer.gameBoard.setPointer(x, y);
    const hit = renderer.gameBoard.activate();
    if (hit.kind === 'cell') doCompress();
    else if (hit.kind === 'shell') doBind(hit.tier);
    else if (hit.kind === 'resonance') doResonance();
    else if (hit.kind === 'phase') doPhase(hit.state);
  }
  function onPointerMove(e: PointerEvent): void {
    if (!renderer) return;
    const { x, y } = canvasXY(e);
    renderer.gameBoard.setPointer(x, y);
    if (pointerDown && game) {
      // 드래그 쓸어담기 — 지나간 float 세포만큼 압축·흡수(연속 손맛).
      const n = renderer.gameBoard.dragAbsorb(x, y);
      for (let i = 0; i < n; i++) doCompress();
    }
  }
  function endPointer(): void {
    pointerDown = false;
  }
  function onPointerLeave(): void {
    pointerDown = false;
    renderer?.gameBoard.clearPointer();
  }

  /** 세포 흡수 = 수동 압축(실제 게임). 획득 E를 중심 떠오르는 수치로 피드백. */
  function doCompress(): void {
    if (!game || !snap) return;
    const before = snap.E;
    game.manualCompress(); // 동기 notify → snap 갱신
    const gained = snap.E.sub(before);
    if (gained.gt(0)) renderer?.gameBoard.spawnCenterText(`+${formatNumber(gained, 2)} E`, '217,184,106');
  }
  /** 껍질 결속 = 압축기 구매(실제 게임, E 비용). 성공 수만큼 결속 비행 피드백. */
  function doBind(tier: number): void {
    if (!game) return;
    const count = game.buy(tier, buyMode);
    if (count > 0) renderer?.gameBoard.onBind(tier, count);
  }
  /** 공명 전자 클릭 = 오비탈 공명(실제 게임, §4). 성공/실패를 전자에 피드백. */
  function doResonance(): void {
    if (!game) return;
    const ok = game.clickResonance();
    renderer?.gameBoard.onResonance(ok);
  }
  /** 위상 노드 클릭 = 고정/해제(실제 게임, §4 표 3행). 고정된 현재 상태 재클릭=해제, 그 외=고정(E). */
  function doPhase(state: BoardPhaseState): void {
    if (!game || !snap) return;
    if (snap.phase.pinned && snap.phase.state === state) {
      game.unpinPhase();
      renderer?.gameBoard.onPhase(state, false);
    } else if (game.pinPhase(state)) {
      renderer?.gameBoard.onPhase(state, true);
    }
  }

  // --- 디바이스 노드(개입 bloom) -----------------------------------------------
  /** 패널 열기 전 포커스였던 요소(닫을 때 복귀 — 접근성). */
  let lastFocused: HTMLElement | null = null;
  function openPanel(p: Panel): void {
    if (activePanel === p) {
      closePanel();
      return;
    }
    lastFocused = (document.activeElement as HTMLElement) ?? null;
    unlockAudio();
    activePanel = p;
  }

  /** 첫 사용자 제스처에서 사운드 unlock(자동재생 정책) + 현재 prefs 재적용(ctx 지연 생성). */
  function unlockAudio(): void {
    if (audioUnlocked || !audio) return;
    audioUnlocked = true;
    audio.unlock();
    audio.setMuted(curPrefs.muted);
    audio.setVolume(curPrefs.volume);
    audio.setAmbientEnabled(curPrefs.ambient);
  }
  function closePanel(): void {
    activePanel = null;
    lastFocused?.focus?.();
    lastFocused = null;
  }

  /**
   * 포커스 트랩 액션(접근성): 열릴 때 패널 내 첫 포커스 가능 요소로 포커스 이동, Tab을 패널 안에 가둠.
   *  Esc 닫기는 전역 onKeydown이 담당. 닫을 때 트리거 복귀는 closePanel.
   */
  function focusTrap(node: HTMLElement) {
    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
    (focusables()[0] ?? node).focus();
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (f.length === 0) {
        e.preventDefault();
        return;
      }
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    node.addEventListener('keydown', onKey);
    return {
      destroy() {
        node.removeEventListener('keydown', onKey);
      },
    };
  }
  /** 입력 필드(가져오기 textarea 등)에 포커스면 게임 단축키 억제 — 타이핑 보호. */
  function isTypingTarget(el: EventTarget | null): boolean {
    const t = el as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable;
  }
  function onKeydown(e: KeyboardEvent): void {
    unlockAudio();
    if (isTypingTarget(e.target)) return; // 텍스트 입력 중엔 단축키 무시
    if (e.key === 'Escape' && activePanel) closePanel();
    else if (e.key === '?') {
      e.preventDefault();
      openPanel('help');
    } else if (e.key === ' ' && !activePanel) {
      // 스페이스 = 압축(관조 중, 포커스가 캔버스/바디일 때만 — 버튼 활성화와 충돌 방지).
      const el = document.activeElement;
      if (!el || el === document.body || (el as HTMLElement).classList?.contains('game-canvas')) {
        e.preventDefault();
        game?.manualCompress();
      }
    } else if (e.key === '1') buyMode = 1;
    else if (e.key === '2') buyMode = 10;
    else if (e.key === '3') buyMode = 100;
    else if (e.key === '4' || e.key.toLowerCase() === 'm') buyMode = 'max';
  }

  // --- 설정(game 위임) ----------------------------------------------------------
  function onNotation(n: NotationKind) {
    game?.setNotation(n);
  }
  function onExport(): string {
    return game?.exportSave() ?? '';
  }
  function onImport(raw: string): void {
    // 검증 실패 시 game.importSave가 throw → SettingsView가 잡아 인라인 오류.
    game?.importSave(raw);
  }
  function onReset(): void {
    game?.resetToFresh();
    closePanel();
  }

  // --- game 위임(오버레이 뷰) ---------------------------------------------------
  function onBuyResearch(nodeId: string) {
    game?.buyResearch(nodeId);
  }
  function onDismissOffline() {
    game?.dismissOffline();
  }
  /** 수동 저장 — 노드에 잠깐 "저장됨" 인라인 피드백(오토세이브는 무토스트, 수동만 신호). */
  let justSaved = false;
  let savedTimer: ReturnType<typeof setTimeout> | null = null;
  async function onSave() {
    await game?.persist();
    justSaved = true;
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => (justSaved = false), 1500);
  }
  function onPrestige() {
    // 빅 크런치(재하강)는 별도 실행 경로. 스냅샷 isBigCrunch로 분기(단방향).
    const ok = snap?.prestige.isBigCrunch ? game?.executeBigCrunch() : game?.executePrestige();
    if (ok) closePanel(); // 실행 성공 → 관조로 복귀(새 층 하강/재하강).
  }
  function onPrestigeContinue() {
    closePanel();
  }

  // --- 파생(FTUE 점진 공개·점등 — 정보 로직 보존 §7-C#3) ------------------------
  $: showCodexNode = snap?.ftue.showCodexTab ?? false;
  $: codexCount = snap?.codex.collected ?? 0;
  $: achieveCount = snap?.achievements.count ?? 0;
  $: showResearchNode = snap?.ftue.showResearchTab ?? false;
  $: showPrestigeNode = snap?.prestige.available ?? false;
  $: prestigeFirst = (snap?.prestige.available && snap?.prestige.isFirst) ?? false;
  $: prestigeBig = snap?.prestige.isBigCrunch ?? false;
  // 노드가 사라졌는데 그 패널이 열려 있으면 닫음(점등 해소·로드 직후 방어).
  $: if (activePanel === 'prestige' && !showPrestigeNode) activePanel = null;
  $: if (activePanel === 'research' && !showResearchNode) activePanel = null;
  // QF 성표는 층 발광색을 따른다(§3-C). layerRgb는 pushRender에서 renderer.layerColorRGB로 갱신.
  $: qfStyle = `color: rgba(${layerRgb}, 0.82);`;
</script>

<svelte:window on:keydown={onKeydown} on:pointerup={endPointer} on:blur={endPointer} />

<Toast bind:this={toast} />

<!-- 풀스크린 게임 캔버스 — 세계 배경 + 전경 게임판. 포인터=만지기 표면(공허가 곧 게임판 §3). -->
<canvas
  class="game-canvas"
  bind:this={bgCanvas}
  on:pointerdown={onPointerDown}
  on:pointermove={onPointerMove}
  on:pointerleave={onPointerLeave}
  aria-label="공허 게임판 — 떠다니는 물질을 만져 압축, 궤도 껍질을 눌러 결속"
></canvas>

<!-- 오프라인 복귀 모달(ui-flow §10, 정보 로직 보존). -->
{#if snap?.offline}
  <OfflineModal offline={snap.offline} onDismiss={onDismissOffline} />
{/if}

{#if snap}
  <!-- 공허에 뜬 희미한 주석층(테두리·카드·배경 0 — §3-A·§3-B). pointer-events는 상호작용 요소만. -->
  <div class="annot-layer" aria-hidden={activePanel ? 'true' : 'false'}>
    <!-- 좌상단: 결속(구매) 수량 모드. -->
    <div class="annot buymode">
      <span class="bm-label">결속</span>
      {#each buyModes as m}
        <button class="bm" class:on={buyMode === m.id} on:click={() => (buyMode = m.id)}
          >{m.label}</button>
      {/each}
    </div>

    <!-- 우상단: 자원 성표(E·C·D·QF·배율). 발견 전(0)이면 흐릿. -->
    <div class="annot resources">
      <div class="res res-e">
        <span class="r-sym">E</span><span class="r-val">{formatNumber(snap.E, 2)}</span>
        <span class="r-rate">{#if snap.rateC.gt(0)}+{formatNumber(snap.rateC, 2)}/s{/if}</span>
      </div>
      <div class="res res-c">
        <span class="r-sym">C</span><span class="r-val">{formatNumber(snap.C, 2)}</span>
        <span class="r-rate">{#if snap.rateC.gt(0)}+{formatNumber(snap.rateC, 2)}/s{/if}</span>
      </div>
      {#if snap.ftue.showResourceD}
        <div class="res res-d">
          <span class="r-sym">D</span><span class="r-val">{formatNumber(snap.D, 2)}</span>
          <span class="r-rate">발견</span>
        </div>
      {/if}
      {#if snap.QF.gt(0)}
        <div class="res res-qf" style={qfStyle}>
          <span class="r-sym">QF</span><span class="r-val">{formatNumber(snap.QF)}</span>
          <span class="r-rate">영구</span>
        </div>
      {/if}
      <div class="res res-mult">
        <span class="r-sym">배율</span><span class="r-val">×{formatNumber(snap.mult, 3)}</span>
      </div>
    </div>

    <!-- 좌하단: r(반경) + 층 — 성표 주석. 작아질수록 더 광막(작음=숭고 §2-A). -->
    <div class="annot vitals">
      <div class="v-r">r = <span class="v-num">{formatRadius(snap.r)}</span></div>
      <div class="v-layer">{snap.layer.nameKo} · dec {snap.dec.toFixed(2)}</div>
    </div>

    <!-- 우하단: 힌트(FTUE) + 속삭임. -->
    <div class="annot whisper">
      {#if snap.ftue.hint}<div class="hint">{snap.ftue.hint}</div>{/if}
      <div class="murmur">물질 속으로, 영원히 천천히 떨어진다.</div>
    </div>

    <!-- 하단 중앙: 잠든 디바이스 노드(개입). 부르면 bloom. (§3-B 가장자리 발광 노드) -->
    <div class="dock">
      <!-- 다이제틱 장치(게임 진행): 어둠에서 피어나는 노드 (§3-B). -->
      <span class="dock-group">
        {#if showResearchNode}
          <button class="node" class:on={activePanel === 'research'} on:click={() => openPanel('research')}
            >연구</button>
        {/if}
        {#if showCodexNode}
          <button class="node" class:on={activePanel === 'codex'} on:click={() => openPanel('codex')}>
            도감{#if codexCount > 0}<span class="badge">{codexCount}</span>{/if}
          </button>
        {/if}
        {#if showPrestigeNode}
          <button
            class="node node-prestige"
            class:on={activePanel === 'prestige'}
            class:first={prestigeFirst || prestigeBig}
            on:click={() => openPanel('prestige')}
            >{prestigeBig ? '빅 크런치' : prestigeFirst ? '미지 진입' : '상전이'}</button>
        {/if}
      </span>
      <span class="dock-sep" aria-hidden="true"></span>
      <!-- 시스템 유틸(관조 밖 도구): 조용한 톤. -->
      <span class="dock-group dock-sys">
        <button class="node node-quiet" class:saved={justSaved} on:click={onSave} title="저장"
          >{justSaved ? '저장됨 ✓' : '저장'}</button>
        <button
          class="node node-quiet"
          class:on={activePanel === 'stats'}
          on:click={() => openPanel('stats')}
          title="기록">기록</button>
        <button
          class="node node-quiet"
          class:on={activePanel === 'achievements'}
          on:click={() => openPanel('achievements')}
          title="관측 목표">목표<span class="badge badge-quiet">{achieveCount}</span></button>
        <button
          class="node node-quiet"
          class:on={activePanel === 'settings'}
          on:click={() => openPanel('settings')}
          title="설정">설정</button>
        <button
          class="node node-quiet"
          class:on={activePanel === 'help'}
          on:click={() => openPanel('help')}
          title="관측 안내 (? 키)">안내</button>
      </span>
    </div>
  </div>

  <!-- 개입 bloom 오버레이 — 디바이스가 피어난다. 배경 클릭/Esc로 물러남(recede §3-B). -->
  {#if activePanel}
    <div
      class="bloom-backdrop"
      role="button"
      tabindex="-1"
      aria-label="닫기"
      on:click={closePanel}
      on:keydown={(e) => e.key === 'Enter' && closePanel()}>
    </div>
    <div class="bloom-panel" role="dialog" aria-modal="true" tabindex="-1" use:focusTrap>
      <button class="bloom-close" on:click={closePanel} aria-label="닫기">✕</button>
      <div class="bloom-body">
        {#if activePanel === 'research'}
          <ResearchView research={snap.research} dCurrent={snap.D} onBuy={onBuyResearch} />
        {:else if activePanel === 'codex'}
          <CodexView codex={snap.codex} />
        {:else if activePanel === 'prestige'}
          <PrestigeView prestige={snap.prestige} onPrestige={onPrestige} onContinue={onPrestigeContinue} />
        {:else if activePanel === 'settings'}
          <SettingsView
            notation={snap.notation}
            {onNotation}
            {onExport}
            {onImport}
            {onReset} />
        {:else if activePanel === 'stats'}
          <StatsView stats={snap.stats} />
        {:else if activePanel === 'achievements'}
          <AchievementsView achievements={snap.achievements} />
        {:else if activePanel === 'help'}
          <HelpView />
        {/if}
      </div>
    </div>
  {/if}
{:else}
  <p class="booting">초기화 중…</p>
{/if}

<style>
  /* 페이지 = 순흑 공허(art §2-B: 화면 90%는 어둠). 캔버스가 그 위에 세계+빛을 그린다. */
  :global(body) {
    margin: 0;
    background: #000;
    overflow: hidden;
    color: #e0eef4;
  }

  /* 풀스크린 게임 캔버스 — 만질 표면. (세계+전경 한 파이프라인) */
  .game-canvas {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    display: block;
    z-index: 0;
    touch-action: none; /* 포인터 드래그(쓸어담기)에서 스크롤/줌 가로채기 방지 */
    cursor: default;
  }

  /* 공허에 뜬 주석층 — 테두리/카드/배경 0. 어둠 위 발광 텍스트만(§3-A 폐기·§3-B 성표). */
  .annot-layer {
    position: fixed;
    inset: 0;
    z-index: 2;
    pointer-events: none; /* 기본 비차단 — 상호작용 요소만 auto */
    font-family: var(--font-numeric, 'Spline Sans Mono', ui-monospace, monospace);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
  }
  .annot {
    position: fixed;
    text-shadow: 0 0 12px rgba(0, 0, 0, 0.92);
  }

  /* 좌상단 결속 모드. */
  .buymode {
    left: 22px;
    top: 16px;
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    pointer-events: auto;
  }
  .bm-label {
    color: rgba(150, 166, 174, 0.55);
    margin-right: 6px;
    letter-spacing: 0.06em;
  }
  .bm {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 5px;
    font: inherit;
    color: rgba(150, 166, 174, 0.5);
    transition: color 0.3s ease;
  }
  .bm.on {
    color: rgba(217, 184, 106, 0.92);
  } /* E 금빛 = 활성 */

  /* 우상단 자원 성표 — 세로. 각자 탈채도색(§3-C 단일 악센트 해체). */
  .resources {
    right: 24px;
    top: 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    text-align: right;
  }
  .res {
    display: flex;
    align-items: baseline;
    gap: 7px;
    line-height: 1.1;
  }
  .res .r-sym {
    font-size: 11px;
    opacity: 0.62;
    letter-spacing: 0.06em;
  }
  .res .r-val {
    font-size: 15px;
    min-width: 0;
  }
  .res .r-rate {
    font-size: 10px;
    opacity: 0.5;
    min-width: 56px;
  }
  .res-e {
    color: rgba(217, 184, 106, 0.86);
  } /* #d9b86a 식은 금 */
  .res-c {
    color: rgba(122, 159, 192, 0.86);
  } /* #7a9fc0 차분한 청 */
  .res-d {
    color: rgba(154, 143, 192, 0.86);
  } /* #9a8fc0 흐린 보라 */
  .res-qf {
    color: rgba(159, 184, 154, 0.82);
  } /* 층색 — inline style이 덮어씀 */
  .res-mult {
    color: rgba(200, 214, 220, 0.7);
  }

  /* 좌하단 r·층 성표. */
  .vitals {
    left: 26px;
    bottom: 22px;
    line-height: 1.7;
  }
  .v-r {
    font-size: 15px;
    color: rgba(224, 238, 244, 0.5);
  }
  .v-r .v-num {
    color: rgba(236, 246, 250, 0.78);
  }
  .v-layer {
    font-size: 12px;
    color: rgba(174, 188, 194, 0.55);
    transition: color 1s ease;
  }

  /* 우하단 힌트·속삭임. */
  .whisper {
    right: 24px;
    bottom: 20px;
    text-align: right;
    line-height: 1.7;
    max-width: 46vw;
  }
  .whisper .hint {
    font-size: 12px;
    color: rgba(150, 168, 178, 0.7);
    font-family: var(--font-narrative, 'Newsreader', 'Gothic A1', serif);
    margin-bottom: 6px;
  }
  .whisper .murmur {
    font-size: 11px;
    color: rgba(110, 126, 134, 0.42);
    font-family: var(--font-narrative, 'Newsreader', 'Gothic A1', serif);
  }

  /* 하단 중앙 디바이스 독 — 잠든 빛. hover/on에서 피어남. */
  .dock {
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    pointer-events: auto;
    position: fixed;
  }
  /* 두 그룹: 다이제틱 장치 | 시스템 유틸. 사이 미묘한 구분(평범한 버튼바 회피). */
  .dock-group {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .dock-group:empty {
    display: none;
  }
  /* 구분선 — 아주 옅은 세로 획(어둠 위 성긴 빛). 장치 그룹이 비면 숨김. */
  .dock-sep {
    width: 1px;
    height: 14px;
    background: rgba(150, 166, 174, 0.16);
  }
  .dock-group:empty + .dock-sep {
    display: none;
  }
  /* 시스템 유틸은 한 톤 더 물러나게(관조 밖 도구 — 게임 장치보다 조용히). */
  .dock-sys {
    opacity: 0.82;
  }
  .node {
    background: none;
    border: none;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    letter-spacing: 0.05em;
    padding: 7px 13px;
    color: rgba(150, 166, 174, 0.5);
    border-radius: 999px;
    transition:
      color 0.4s ease,
      text-shadow 0.4s ease;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .node:hover {
    color: rgba(210, 224, 230, 0.85);
    text-shadow: 0 0 10px rgba(160, 190, 210, 0.45);
  }
  .node-quiet.saved {
    color: rgba(168, 196, 182, 0.95); /* QF 톤 — 저장 확인 */
    text-shadow: 0 0 12px rgba(120, 175, 150, 0.5);
  }
  .node.on {
    color: rgba(228, 240, 246, 0.95);
    text-shadow: 0 0 14px rgba(160, 200, 220, 0.6);
  }
  .node-quiet {
    color: rgba(120, 134, 142, 0.38);
  }
  .node-prestige.first {
    color: rgba(138, 127, 208, 0.9);
    animation: node-pulse 1.6s ease-in-out infinite;
  }
  @keyframes node-pulse {
    0%,
    100% {
      text-shadow: 0 0 0 transparent;
      opacity: 0.7;
    }
    50% {
      text-shadow: 0 0 12px rgba(138, 127, 208, 0.7);
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .node-prestige.first {
      animation: none;
      opacity: 1;
    }
  }
  .badge {
    font-size: 10px;
    color: #0a0e0c;
    background: rgba(154, 143, 192, 0.9);
    border-radius: 999px;
    padding: 0 5px;
    min-width: 15px;
    text-align: center;
  }
  /* 목표 노드 배지 — 조용한 QF 톤(도감 보라 badge와 구분, 관조 팔레트). */
  .badge-quiet {
    color: rgba(200, 214, 220, 0.7);
    background: rgba(120, 134, 142, 0.28);
    margin-left: 4px;
  }

  /* 개입 bloom 오버레이 — 어둠이 깊어지고 디바이스가 피어난다. */
  .bloom-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9;
    background: rgba(2, 4, 7, 0.62);
    backdrop-filter: blur(3px);
    border: none;
    cursor: default;
    animation: bloom-fade 0.3s ease-out;
  }
  .bloom-panel {
    position: fixed;
    z-index: 10;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(560px, 92vw);
    max-height: 86vh;
    overflow-y: auto;
    padding: 18px;
    background: color-mix(in srgb, #0a1014 88%, transparent);
    border-radius: 14px;
    box-shadow: 0 0 60px rgba(0, 0, 0, 0.7);
    animation: bloom-rise 0.32s cubic-bezier(0.16, 1, 0.3, 1);
    /* ───── 공허 팔레트 오버라이드(§7-C#2: 네온 카드 폐기) ─────
       콘텐츠 뷰(연구·도감·상전이)는 구 대시보드 토큰(네온 #3ecf8e/카드 테두리)을 쓴다.
       여기서 색 토큰만 탈채도 공허 톤으로 remap → 자식 뷰 전체가 한 번에 cosmic화(구조 불변,
       custom property 캐스케이드). 간격·서체·모션 토큰은 유지. */
    --canvas: #06070d;
    --canvas-layer: #0b1016;
    --surface: #121a22;
    --border: #1c2733;
    --foreground: #e2eef4;
    --foreground-sub: #8ba0ad;
    --foreground-dim: #4b5d69;
    --primary: #a6b8cc; /* 신호색 — 탈채도 청회(네온 녹 폐기) */
    --qf: #a8c4b6; /* 양자 거품 — 탈채도 민트회 */
    --layer-accent: #a6b8cc; /* 안정 탈채도 악센트(동적 네온 대체) */
    --layer-glow: #6f8496;
    --layer-prn-accent: #9a8fd0; /* 프리온 보라(냉기) */
    --energy: #d9b86a; /* 식은 금 (board와 정합) */
    --depth: #7a9fc0; /* 차분한 청 */
    --data: #9a8fc0; /* 흐린 보라 */
    --col-keep: #7faf96; /* 보존 — 탈채도 녹 */
    --col-reset: #c08a8a; /* 리셋 — 탈채도 로즈 */
    --col-partial: #c4a06a; /* 부분 — 탈채도 호박 */
    --legendary: #d8c489; /* 전설 — 부드러운 금 */
  }
  @keyframes bloom-fade {
    from {
      opacity: 0;
    }
  }
  @keyframes bloom-rise {
    from {
      opacity: 0;
      transform: translate(-50%, -46%) scale(0.97);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .bloom-backdrop,
    .bloom-panel {
      animation: none;
    }
  }
  .bloom-close {
    position: absolute;
    right: 12px;
    top: 10px;
    z-index: 1;
    background: none;
    border: none;
    color: rgba(180, 196, 206, 0.6);
    font-size: 15px;
    cursor: pointer;
    padding: 4px 8px;
  }
  .bloom-close:hover {
    color: rgba(228, 240, 246, 0.95);
  }

  .booting {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(150, 166, 174, 0.6);
    font-family: var(--font-narrative, 'Newsreader', 'Gothic A1', serif);
  }

  /* 좁은 화면(모바일/세로): 주석 크라우딩 완화 — 폰트·여백 축소, 속삭임 숨김(공허 우선). */
  @media (max-width: 600px) {
    .buymode {
      left: 12px;
      top: 10px;
      font-size: 11px;
    }
    .resources {
      right: 12px;
      top: 10px;
      gap: 6px;
    }
    .res .r-val {
      font-size: 13px;
    }
    .res .r-rate {
      min-width: 40px;
    }
    .vitals {
      left: 14px;
      bottom: 118px; /* 하단 독(모바일 최대 3줄 접힘) 위로 — 겹침 방지 */
    }
    .vitals .v-r {
      font-size: 13px;
    }
    .whisper {
      right: 14px;
      bottom: 118px;
      max-width: 46vw;
    }
    .whisper .murmur {
      display: none; /* 좁은 화면에선 속삭임 생략 — 힌트만 */
    }
    .dock {
      bottom: 12px;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: center;
      max-width: 96vw;
    }
    .dock-group {
      display: contents; /* 모바일: 그룹 평탄화 — 8노드가 한 흐름으로 균일 접힘(중첩 wrap 회피) */
    }
    .dock-sep {
      display: none; /* 좁은 화면: 그룹이 줄바꿈되므로 세로 구분선 생략 */
    }
    .node {
      padding: 6px 9px;
      font-size: 11px;
    }
    .bloom-panel {
      width: 94vw;
      padding: 14px;
    }
  }
</style>
