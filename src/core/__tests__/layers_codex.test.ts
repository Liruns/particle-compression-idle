/**
 * 알려진 물리 층 시스템 + 도감 무결성·동작 검증. (M1.3)
 * codex.md §2-6 / data-spec §2·§4 / systems.md §1-2 / economy.md §7.1 정합을 증명한다.
 *
 * 커버:
 *  - 층 데이터 무결성: 11층 정의, slug/index 고유, enterDec 단조, 알려진 물리 5층.
 *  - 입자 데이터 무결성: 57입자(8/13/10/9/17), id 고유, layer 참조 유효, unlockDec ∈ 층 대역.
 *  - 층 매핑: dec→층 index(분자0/원자1/핵5/핵자6/쿼크9), 알려진 물리 캡(L5).
 *  - 층 진입: layersEnteredSince 멱등·순서·점프(오프라인).
 *  - 도감 발견: dec 게이트, LEGENDARY 층 완성 시 해금, 영구성, 완성도/분모(76).
 *  - FTUE: 단계 단조, 점진 공개 플래그.
 *  - 직렬화: layers/codex 라운드트립(Set↔array), 구버전 기본값.
 */
import { describe, it, expect } from 'vitest';
import {
  LAYERS,
  KNOWN_LAYERS,
  currentLayerIndex,
  currentLayer,
  layersEnteredSince,
  LAST_KNOWN_LAYER_INDEX,
  isNearKnownBoundary,
} from '../layers';
import {
  PARTICLES,
  particlesByLayer,
  particleById,
} from '../../data/particles';
import {
  evaluateDiscoveries,
  isLayerDiscoverableComplete,
  layerCompletion,
  knownLayerCompletions,
  codexCompletion,
  holographicMultiplier,
  discoverableCollected,
  CODEX_DENOMINATOR,
  CODEX_BONUS_FACTOR,
} from '../codex';
import { deriveFtue } from '../ftue';
import { serializeState, deserializeState, type SaveData } from '../save/serialize';
import { createInitialState } from '../state';

// --- 층 데이터 무결성 -------------------------------------------------------
describe('층 데이터 무결성 — data-spec §4 / systems §1-2', () => {
  it('11층 정의 + index 1..11 연속', () => {
    expect(LAYERS.length).toBe(11);
    for (let i = 0; i < 11; i++) expect(LAYERS[i].index).toBe(i + 1);
  });

  it('slug·id·index 전체 고유', () => {
    expect(new Set(LAYERS.map((l) => l.slug)).size).toBe(11);
    expect(new Set(LAYERS.map((l) => l.id)).size).toBe(11);
    expect(new Set(LAYERS.map((l) => l.index)).size).toBe(11);
  });

  it('알려진 물리 5층(L1~L5) = known, 미지 6층 = unknown', () => {
    expect(KNOWN_LAYERS.length).toBe(5);
    expect(KNOWN_LAYERS.map((l) => l.id)).toEqual([
      'molecule',
      'atom',
      'nucleus',
      'hadron',
      'quark',
    ]);
    for (const l of KNOWN_LAYERS) {
      expect(l.kind).toBe('known');
      expect(l.real).toBe(true);
      // 알려진 물리는 상전이 없음(필러④ "층 진입 ≠ 상전이").
      expect(l.prestigeWallDec).toBeNull();
      expect(l.prestigeIndex).toBeNull();
    }
  });

  it('enterDec = systems §1-2 (분자0/원자1/핵5/핵자6/쿼크9)', () => {
    const known = KNOWN_LAYERS;
    expect(known.map((l) => l.enterDec)).toEqual([0, 1, 5, 6, 9]);
  });

  it('알려진 물리 enterDec 단조 증가', () => {
    for (let i = 1; i < KNOWN_LAYERS.length; i++) {
      expect(KNOWN_LAYERS[i].enterDec).toBeGreaterThan(KNOWN_LAYERS[i - 1].enterDec);
    }
  });

  it('미지 6층 prestige 벽 = economy WALLS [19,21.5,23,24.5,25.5,26]', () => {
    const unknown = LAYERS.filter((l) => l.kind === 'unknown');
    expect(unknown.length).toBe(6);
    expect(unknown.map((l) => l.prestigeWallDec)).toEqual([19, 21.5, 23, 24.5, 25.5, 26]);
    expect(unknown.map((l) => l.prestigeIndex)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('slug가 DESIGN 토큰과 정합(mol/atom/nuc/ncl/qrk)', () => {
    expect(KNOWN_LAYERS.map((l) => l.slug)).toEqual(['mol', 'atom', 'nuc', 'ncl', 'qrk']);
  });
});

// --- 입자 데이터 무결성 -----------------------------------------------------
describe('입자 데이터 무결성 — codex §2-6 / data-spec §2', () => {
  it('57 알려진 물리 입자(분자8/원자13/핵10/핵자9/쿼크17)', () => {
    expect(PARTICLES.length).toBe(57);
    expect(particlesByLayer(1).length).toBe(8);
    expect(particlesByLayer(2).length).toBe(13);
    expect(particlesByLayer(3).length).toBe(10);
    expect(particlesByLayer(4).length).toBe(9);
    expect(particlesByLayer(5).length).toBe(17);
  });

  it('id 전체 고유', () => {
    expect(new Set(PARTICLES.map((p) => p.id)).size).toBe(57);
  });

  it('모든 입자 layer ∈ 1..5 (알려진 물리)', () => {
    for (const p of PARTICLES) {
      expect(p.layer).toBeGreaterThanOrEqual(1);
      expect(p.layer).toBeLessThanOrEqual(5);
    }
  });

  it('discoverable=false ⇔ LEGENDARY (data-spec §2-C)', () => {
    for (const p of PARTICLES) {
      if (p.rarity === 'LEGENDARY') expect(p.discoverable).toBe(false);
      else expect(p.discoverable).toBe(true);
    }
  });

  it('LEGENDARY 완성 보너스 = 4개(L2~L5, L1은 없음)', () => {
    const leg = PARTICLES.filter((p) => p.rarity === 'LEGENDARY');
    expect(leg.length).toBe(4);
    expect(leg.map((p) => p.layer).sort()).toEqual([2, 3, 4, 5]);
  });

  it('discoverable 입자 = 53 (57 − 4 LEGENDARY)', () => {
    expect(PARTICLES.filter((p) => p.discoverable).length).toBe(53);
  });

  it('unlockDec가 층 대역 안(층 enterDec 이상)', () => {
    for (const p of PARTICLES) {
      const def = KNOWN_LAYERS.find((l) => l.index === p.layer)!;
      expect(p.unlockDec).toBeGreaterThanOrEqual(def.enterDec);
    }
  });

  it('층 내 unlockDec 비감소(점진 발견 — 한 층=한 새로움)', () => {
    for (const l of KNOWN_LAYERS) {
      const list = particlesByLayer(l.index);
      for (let i = 1; i < list.length; i++) {
        expect(list[i].unlockDec).toBeGreaterThanOrEqual(list[i - 1].unlockDec);
      }
    }
  });

  it('실제 입자(real=true) — 물리 필드 형식(data-spec §2-D)', () => {
    for (const p of PARTICLES) {
      if (!p.real) continue;
      // charge·spin: 숫자 또는 null(개념 엔트리 — isomer/QGP/완성보너스, codex §4 허용).
      expect(p.charge === null || typeof p.charge === 'number').toBe(true);
      expect(p.spin === null || typeof p.spin === 'number').toBe(true);
      // scaleM은 항상 비어있지 않은 문자열.
      expect(p.scaleM.length).toBeGreaterThan(0);
      // charge는 유한값(원자는 full Z = 26·92 등 허용 — data-spec −2~+2는 입자 한정).
      if (typeof p.charge === 'number') expect(Number.isFinite(p.charge)).toBe(true);
    }
  });

  it('particleById 조회', () => {
    expect(particleById('water_molecule')?.layer).toBe(1);
    expect(particleById('top_quark')?.rarity).toBe('RARE');
    expect(particleById('nonexistent')).toBeUndefined();
  });
});

// --- 층 매핑 ----------------------------------------------------------------
describe('층 매핑 — currentLayerIndex (systems §1-2)', () => {
  it('dec → 알려진 물리 층 index', () => {
    expect(currentLayerIndex(0)).toBe(1); // 분자
    expect(currentLayerIndex(0.5)).toBe(1);
    expect(currentLayerIndex(1)).toBe(2); // 원자
    expect(currentLayerIndex(4.9)).toBe(2);
    expect(currentLayerIndex(5)).toBe(3); // 핵
    expect(currentLayerIndex(5.9)).toBe(3);
    expect(currentLayerIndex(6)).toBe(4); // 핵자
    expect(currentLayerIndex(8.9)).toBe(4);
    expect(currentLayerIndex(9)).toBe(5); // 쿼크
  });

  it('알려진 물리 캡: dec9 이상이어도 L5(미지 진입은 상전이, M1.5+)', () => {
    expect(currentLayerIndex(9)).toBe(5);
    expect(currentLayerIndex(15)).toBe(5);
    expect(currentLayerIndex(19)).toBe(5);
    expect(currentLayerIndex(26)).toBe(5);
    expect(LAST_KNOWN_LAYER_INDEX).toBe(5);
  });

  it('음수/0 → 분자층', () => {
    expect(currentLayerIndex(-1)).toBe(1);
    expect(currentLayer(0).slug).toBe('mol');
    expect(currentLayer(9).slug).toBe('qrk');
  });

  it('알려진 입자 경계 근접(dec15+)', () => {
    expect(isNearKnownBoundary(14.9)).toBe(false);
    expect(isNearKnownBoundary(15)).toBe(true);
  });
});

// --- 층 진입 ----------------------------------------------------------------
describe('층 진입 — layersEnteredSince (무상전이, 멱등)', () => {
  it('변화 없으면 빈 배열', () => {
    expect(layersEnteredSince(1, 0.5)).toEqual([]);
    expect(layersEnteredSince(2, 1.2)).toEqual([]);
  });

  it('한 층 진입', () => {
    expect(layersEnteredSince(1, 1)).toEqual([2]); // 분자→원자
    expect(layersEnteredSince(2, 5)).toEqual([3]); // 원자→핵
  });

  it('여러 층 점프(오프라인 — 빠짐없이 순서대로)', () => {
    // 분자(1) 상태에서 dec9 도달 → 원자·핵·핵자·쿼크 진입 비트 모두 발행.
    expect(layersEnteredSince(1, 9)).toEqual([2, 3, 4, 5]);
    // 원자(2)에서 dec6 → 핵·핵자.
    expect(layersEnteredSince(2, 6)).toEqual([3, 4]);
  });

  it('역행 무시(알려진 물리는 리셋 없음)', () => {
    expect(layersEnteredSince(5, 1)).toEqual([]);
    expect(layersEnteredSince(3, 0)).toEqual([]);
  });
});

// --- 도감 발견 --------------------------------------------------------------
describe('도감 발견 — evaluateDiscoveries (dec 게이트, codex §13)', () => {
  it('dec0 → 물 분자(unlockDec 0) 즉시 발견', () => {
    const newly = evaluateDiscoveries(0, new Set());
    expect(newly).toContain('water_molecule');
  });

  it('이미 발견한 것은 재발견 안 함(멱등)', () => {
    const have = new Set(['water_molecule']);
    const newly = evaluateDiscoveries(0, have);
    expect(newly).not.toContain('water_molecule');
  });

  it('dec 미달이면 발견 안 함', () => {
    const newly = evaluateDiscoveries(0, new Set());
    // co2(unlockDec 0.15)는 dec0에서 아직.
    expect(newly).not.toContain('co2_molecule');
    expect(evaluateDiscoveries(0.2, new Set()).includes('co2_molecule')).toBe(true);
  });

  it('L1 전체(8개) 발견 시 — L1엔 LEGENDARY 없음(buckyball이 8번째 RARE)', () => {
    const newly = evaluateDiscoveries(1, new Set()); // dec1이면 L1 unlockDec(≤0.95) 전부
    const l1 = particlesByLayer(1).map((p) => p.id);
    for (const id of l1) expect(newly).toContain(id);
  });

  it('LEGENDARY는 층 discoverable 전부 발견 시 해금', () => {
    // L2 discoverable 12개를 모두 가진 상태 + dec5(l2_completion unlockDec=5).
    const l2Disc = particlesByLayer(2)
      .filter((p) => p.discoverable)
      .map((p) => p.id);
    const have = new Set(l2Disc);
    expect(isLayerDiscoverableComplete(2, have)).toBe(true);
    const newly = evaluateDiscoveries(5, have);
    expect(newly).toContain('l2_completion');
  });

  it('LEGENDARY 미해금: 층 discoverable 아직 전부 안 열림(dec2)', () => {
    // dec2에선 L2 discoverable 중 unlockDec>2(oxygen 2.2 등 ~ νₑ 4.8)가 미발견 → 층 미완성.
    const newly = evaluateDiscoveries(2, new Set());
    expect(newly).not.toContain('l2_completion');
    // dec2 발견분만으로는 L2 완성 안 됨.
    const after = new Set(newly);
    expect(isLayerDiscoverableComplete(2, after)).toBe(false);
  });

  it('dec9까지 누적 발견하면 L1~L4 + 쿼크 일부', () => {
    // 한 번에 dec9 평가(누적 발견 시뮬). L1~L4 완성 + 쿼크 unlockDec≤9.
    let discovered = new Set<string>();
    const newly = evaluateDiscoveries(9, discovered);
    for (const id of newly) discovered.add(id);
    // L1~L4 전부 발견(완성보너스 포함).
    expect(layerCompletion(1, discovered).collected).toBe(8);
    expect(layerCompletion(2, discovered).collected).toBe(13);
    expect(layerCompletion(3, discovered).collected).toBe(10);
    expect(layerCompletion(4, discovered).collected).toBe(9);
    // 쿼크는 up(9) 발견, top(11.5) 미발견.
    expect(discovered.has('up_quark')).toBe(true);
    expect(discovered.has('top_quark')).toBe(false);
  });
});

// --- 완성도 / 홀로그래픽 ----------------------------------------------------
describe('완성도 — codexCompletion / 홀로그래픽 (economy §7.1)', () => {
  it('분모 = 76 (LEGENDARY 11 제외)', () => {
    expect(CODEX_DENOMINATOR).toBe(76);
    expect(CODEX_BONUS_FACTOR).toBe(0.35);
  });

  it('빈 도감 → 완성도 0, 배율 1.0', () => {
    expect(codexCompletion(new Set())).toBe(0);
    expect(holographicMultiplier(new Set())).toBe(1);
  });

  it('discoverableCollected는 LEGENDARY 제외', () => {
    const have = new Set(['water_molecule', 'l2_completion']); // 후자는 LEGENDARY
    expect(discoverableCollected(have)).toBe(1);
  });

  it('홀로그래픽 곡선 B: 1 + min(0.35·c², 0.35), 상한 ×1.35', () => {
    // 53/76 ≈ 0.697 → 0.35·0.697² ≈ 0.170 → ×1.170 (알려진 물리 전부 발견 시).
    const allKnown = new Set(PARTICLES.filter((p) => p.discoverable).map((p) => p.id));
    const c = codexCompletion(allKnown);
    expect(c).toBeCloseTo(53 / 76, 5);
    const mult = holographicMultiplier(allKnown);
    expect(mult).toBeCloseTo(1 + 0.35 * c * c, 6);
    expect(mult).toBeLessThanOrEqual(1.35); // 상한 불변(economy §7.2 가드레일)
  });

  it('층별 완성 현황 5개(알려진 물리)', () => {
    const completions = knownLayerCompletions(new Set());
    expect(completions.length).toBe(5);
    expect(completions.map((c) => c.total)).toEqual([8, 13, 10, 9, 17]);
  });
});

// --- FTUE -------------------------------------------------------------------
describe('FTUE 점진 공개 — deriveFtue (ux.md §3)', () => {
  const base = {
    hasBoughtAnyTier: false,
    canAffordFirstTier: false,
    discoveredCount: 0,
    layerIndex: 1,
    hasPrestiged: false,
    hasDiscoveryData: false,
  };

  it('초기(click): 체인·도감 탭 숨김', () => {
    const f = deriveFtue(base);
    expect(f.stage).toBe('click');
    expect(f.showChain).toBe(false);
    expect(f.showCodexTab).toBe(false);
    expect(f.hint).toContain('압축');
  });

  it('T1 구매 가능 → firstTier + 체인 노출', () => {
    const f = deriveFtue({ ...base, canAffordFirstTier: true });
    expect(f.stage).toBe('firstTier');
    expect(f.showChain).toBe(true);
  });

  it('첫 발견 → codex + 도감 탭', () => {
    const f = deriveFtue({ ...base, discoveredCount: 1 });
    expect(f.stage).toBe('codex');
    expect(f.showCodexTab).toBe(true);
    expect(f.showChain).toBe(true); // 누적
  });

  it('원자층(2) 진입 → layering + 메커니즘 슬롯', () => {
    const f = deriveFtue({ ...base, layerIndex: 2, discoveredCount: 5 });
    expect(f.stage).toBe('layering');
    expect(f.showMechanismSlot).toBe(true);
  });

  it('M1.3은 연구·D·QF 미노출', () => {
    const f = deriveFtue({ ...base, layerIndex: 5, discoveredCount: 40 });
    expect(f.showResearchTab).toBe(false);
    expect(f.showResourceD).toBe(false);
    expect(f.showResourceQF).toBe(false);
  });
});

// --- 직렬화: layers/codex ---------------------------------------------------
describe('직렬화 — layers/codex 라운드트립 (§1.1·§1.3)', () => {
  it('layers.currentIndex + codex.discovered 보존', () => {
    const s = createInitialState();
    s.layers.currentIndex = 4;
    s.codex.discovered = new Set(['water_molecule', 'electron', 'up_quark']);
    const data = serializeState(s);
    const back = deserializeState(data);
    expect(back.layers.currentIndex).toBe(4);
    expect(back.codex.discovered.has('water_molecule')).toBe(true);
    expect(back.codex.discovered.has('up_quark')).toBe(true);
    expect(back.codex.discovered.size).toBe(3);
  });

  it('codex Set → 정렬 배열(결정적 직렬화 — 체크섬 안정)', () => {
    const s = createInitialState();
    s.codex.discovered = new Set(['zebra', 'alpha', 'mike']);
    const data = serializeState(s);
    expect(data.codex?.discovered).toEqual(['alpha', 'mike', 'zebra']);
  });

  it('구버전 세이브(layers/codex 없음) → 기본값(분자층·빈 도감)', () => {
    const init = serializeState(createInitialState());
    const legacy = { ...init };
    delete (legacy as Partial<SaveData>).layers;
    delete (legacy as Partial<SaveData>).codex;
    const back = deserializeState(legacy as SaveData);
    expect(back.layers.currentIndex).toBe(1);
    expect(back.codex.discovered.size).toBe(0);
  });

  it('손상 방어: 범위 밖 index → 1, 비문자열 ID 무시', () => {
    const init = serializeState(createInitialState());
    const bad = {
      ...init,
      layers: { currentIndex: 999 },
      codex: { discovered: ['valid', 123, '', null] as unknown as string[] },
    };
    const back = deserializeState(bad as SaveData);
    expect(back.layers.currentIndex).toBe(11); // 클램프 상한
    expect(back.codex.discovered.has('valid')).toBe(true);
    expect(back.codex.discovered.size).toBe(1);
  });
});
