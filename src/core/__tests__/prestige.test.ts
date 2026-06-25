/**
 * 첫 상전이 PT1 검증 (M1.5 — dec19 프리온 진입). (economy.md §1·§1.2, systems.md §5-2, system-flows.md §3·§4)
 * economy 확정값과의 정합을 증명한다(QF 수식·벽·리셋 매트릭스·부스트).
 *
 * 커버:
 *  - QF 수식: QF_total = floor(K·(lifetime_C/1e26)^0.5), QF_gain = total − claimed (economy §1.1).
 *  - economy 확정값 정합: dec19 도달 시 PT1 +QF = 41 (economy §1.2 PT1 행).
 *  - 벽 판정: WALLS=[19,21.5,23,24.5,25.5,26], 미지 6벽만 트리거(알려진 물리 dec0~18 = 무상전이).
 *  - nextPrestigeIndex: 한 번에 1 상전이씩(점프해도 단계 진행), prestigeCount 차감.
 *  - 리셋 매트릭스(systems §5-2): E·C·체인 리셋 / lifetime_C·QF·도감·연구·D_lifetime 보존.
 *  - 부스트: 상전이 후 production_mult = 1 + 0.25·log₁₀(1+QF) 영구 적용.
 *  - 상태머신(game.ts): 런 → dec19 도달 → executePrestige → 프리온층 진입(currentIndex=6).
 *  - 세이브 라운드트립: prestige 상태(count·qfClaimed) 보존 + 결정성.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { D, ZERO } from '../bignum';
import {
  qfTotal,
  qfGain,
  wallReachedIndex,
  nextPrestigeIndex,
  isPrestigeAvailable,
  isBigCrunchReady,
  previewPrestige,
  applyPrestigeReset,
  QF_K,
  QF_D_NORM,
  QF_EXPONENT,
  UNKNOWN_LAYER_COUNT,
} from '../prestige';
import { WALLS } from '../../data/constants';
import { computeDec, productionMult } from '../chain';
import { seedBought, createInitialState, setState, getState } from '../state';
import { SEED_T1_BOUGHT } from '../chain';
import { serializeState, deserializeState } from '../save/serialize';
import { layerByPrestigeIndex } from '../layers';

// dec → 해당 dec를 만드는 C(역산: C = 10^(dec/α) − 1, α=0.65). 테스트에서 lifetime_C 세팅용.
function cAtDec(dec: number): import('../bignum').Decimal {
  return D(10).pow(dec / 0.65).sub(1);
}

describe('QF 수식 — economy §1.1 (QF_total = floor(K·(lifetime_C/1e26)^0.5))', () => {
  it('상수 정합: K=1, D_norm=1e26, e=0.5', () => {
    expect(QF_K).toBe(1);
    expect(QF_D_NORM).toBe('1e26');
    expect(QF_EXPONENT).toBe(0.5);
  });

  it('lifetime_C ≤ 0 → QF 0', () => {
    expect(qfTotal(0).eq(0)).toBe(true);
    expect(qfTotal(D('-5')).eq(0)).toBe(true);
  });

  it('정확 항등: floor((lifetime_C/1e26)^0.5)', () => {
    // lifetime_C = 4e26 → (4e26/1e26)^0.5 = 2 → floor 2.
    expect(qfTotal(D('4e26')).eq(2)).toBe(true);
    // lifetime_C = 1e26 → ratio 1 → ^0.5 = 1 → 1.
    expect(qfTotal(D('1e26')).eq(1)).toBe(true);
    // lifetime_C = 9e26 → 3.
    expect(qfTotal(D('9e26')).eq(3)).toBe(true);
    // 소수부 floor: 1.21e26 → sqrt(1.21)=1.1 → floor 1.
    expect(qfTotal(D('1.21e26')).eq(1)).toBe(true);
  });

  it('★ economy §1.2 확정값: dec19 도달 시 PT1 +QF = 41', () => {
    // dec19를 만드는 C = 10^(19/0.65) − 1 ≈ 1.70e29. (lifetime_C 동일 가정 — 첫 런.)
    const lifetimeC = cAtDec(19);
    // (1.70e29/1e26)^0.5 = (1701.25)^0.5 ≈ 41.25 → floor 41.
    expect(qfTotal(lifetimeC).eq(41)).toBe(true);
    // 첫 상전이라 qfClaimed=0 → gain = total = 41.
    expect(qfGain(lifetimeC, 0).eq(41)).toBe(true);
  });

  it('QF_gain = total − claimed (이미 청구분 차감)', () => {
    // total 41, claimed 10 → gain 31.
    expect(qfGain(cAtDec(19), 10).eq(31)).toBe(true);
    // claimed == total → gain 0.
    expect(qfGain(cAtDec(19), 41).eq(0)).toBe(true);
    // claimed > total(비정상) → 0 클램프(음수 방지).
    expect(qfGain(cAtDec(19), 100).eq(0)).toBe(true);
  });

  it('베켄슈타인 K=1.05 (빅 크런치, economy §7.4) — 선형 prefactor', () => {
    // 같은 lifetime_C에서 K=1.05 → QF ×1.05 (floor 전). 1e26에서 floor(1.05)=1.
    expect(qfTotal(D('1e26'), 1.05).eq(1)).toBe(true);
    // 4e26: floor(1.05·2)=floor(2.1)=2.
    expect(qfTotal(D('4e26'), 1.05).eq(2)).toBe(true);
    // 큰 값에서 차이 확인: dec19 lifetime_C, K=1.05 → floor(41.25·1.05)=floor(43.31)=43.
    expect(qfTotal(cAtDec(19), 1.05).eq(43)).toBe(true);
  });
});

describe('벽 판정 — WALLS=[19,21.5,23,24.5,25.5,26] (economy §1.2)', () => {
  it('WALLS 데이터 정합(6벽, dec26 캡)', () => {
    expect([...WALLS]).toEqual([19, 21.5, 23, 24.5, 25.5, 26]);
    expect(UNKNOWN_LAYER_COUNT).toBe(6);
  });

  it('알려진 물리 구간(dec0~18) = 벽 미도달(상전이 트리거 없음)', () => {
    for (const dec of [0, 1, 5, 9, 15, 18, 18.99]) {
      expect(wallReachedIndex(dec)).toBe(0);
    }
  });

  it('미지 벽 도달 → prestigeIndex 1..6', () => {
    expect(wallReachedIndex(19)).toBe(1); // 프리온
    expect(wallReachedIndex(20)).toBe(1); // 19~21.5 사이는 여전히 1
    expect(wallReachedIndex(21.5)).toBe(2); // 끈
    expect(wallReachedIndex(23)).toBe(3); // 루프
    expect(wallReachedIndex(24.5)).toBe(4); // 거품
    expect(wallReachedIndex(25.5)).toBe(5); // 정보
    expect(wallReachedIndex(26)).toBe(6); // 플랑크(빅 크런치)
    expect(wallReachedIndex(30)).toBe(6); // 캡 — 26 초과도 6
  });

  it('>= 비교(경계 정확): 정확히 19에서 도달', () => {
    expect(wallReachedIndex(18.9999)).toBe(0);
    expect(wallReachedIndex(19)).toBe(1);
  });
});

describe('nextPrestigeIndex — 한 번에 1 상전이 (system-flows §3.5)', () => {
  it('미도달(dec<19, count=0) → 0(불가)', () => {
    expect(nextPrestigeIndex(15, 0)).toBe(0);
    expect(isPrestigeAvailable(15, 0)).toBe(false);
  });

  it('dec19 도달 + count=0 → 다음 상전이 1(프리온)', () => {
    expect(nextPrestigeIndex(19, 0)).toBe(1);
    expect(isPrestigeAvailable(19, 0)).toBe(true);
  });

  it('count 차감: 이미 1회 했으면 같은 벽에서 재상전이 불가', () => {
    // dec19에서 1회 상전이(count=1) → 더 압축 전엔 불가(reached 1 ≤ count 1).
    expect(nextPrestigeIndex(19, 1)).toBe(0);
    // 더 압축해 dec21.5 도달 → 다음 상전이 2.
    expect(nextPrestigeIndex(21.5, 1)).toBe(2);
  });

  it('점프해도 한 단계씩: dec26·count0 → 1 (한 번에 1)', () => {
    // 오프라인으로 dec26까지 점프해도 다음 상전이는 1(프리온)부터.
    expect(nextPrestigeIndex(26, 0)).toBe(1);
    // count가 오르며 순차 진행.
    expect(nextPrestigeIndex(26, 1)).toBe(2);
    expect(nextPrestigeIndex(26, 5)).toBe(6);
    expect(nextPrestigeIndex(26, 6)).toBe(0); // 6벽 다 소진 → 불가(빅 크런치는 M3).
  });

  it('isBigCrunchReady: 다음 상전이가 6(플랑크)이면 빅 크런치 대기', () => {
    expect(isBigCrunchReady(26, 5)).toBe(true); // 다음 = 6
    expect(isBigCrunchReady(19, 0)).toBe(false); // 다음 = 1
  });
});

describe('상전이 미리보기 — previewPrestige', () => {
  it('미도달 → null', () => {
    expect(previewPrestige(15, 0, cAtDec(15), 0)).toBeNull();
  });

  it('dec19·count0 → 프리온(L6), QF +41', () => {
    const lifetimeC = cAtDec(19);
    const p = previewPrestige(19, 0, lifetimeC, 0);
    expect(p).not.toBeNull();
    expect(p!.prestigeIndex).toBe(1);
    expect(p!.targetLayer.id).toBe('preon');
    expect(p!.targetLayer.index).toBe(6);
    expect(p!.qfTotal.eq(41)).toBe(true);
    expect(p!.qfGain.eq(41)).toBe(true);
  });

  it('진입 층 = layerByPrestigeIndex 정합', () => {
    expect(layerByPrestigeIndex(1)?.id).toBe('preon');
    expect(layerByPrestigeIndex(6)?.id).toBe('planck');
  });
});

describe('리셋 매트릭스 — systems §5-2 (순수 applyPrestigeReset)', () => {
  it('E·C·체인 리셋 / QF 누적·확정', () => {
    const lifetimeC = cAtDec(19);
    const preview = previewPrestige(19, 0, lifetimeC, 0)!;
    // 현재 QF 0(첫 상전이) → 리셋 후 QF = gain = 41.
    const reset = applyPrestigeReset(preview, ZERO, 0, seedBought);

    expect(reset.E.eq(0)).toBe(true);
    expect(reset.C.eq(0)).toBe(true);
    // 체인 = 시드(T1 1개, 나머지 0).
    expect(reset.bought[0]).toBe(SEED_T1_BOUGHT);
    expect(reset.bought.slice(1).every((b) => b === 0)).toBe(true);
    expect(reset.produced.every((p) => p.eq(0))).toBe(true);
    // QF 확정.
    expect(reset.qfClaimed.eq(41)).toBe(true);
    expect(reset.QF.eq(41)).toBe(true);
    // 프리온 진입 + count 증가.
    expect(reset.layerIndex).toBe(6);
    expect(reset.count).toBe(1);
  });

  it('QF 가산(이전 QF + gain) — 비정상에서도 줄지 않음', () => {
    const lifetimeC = cAtDec(21.5); // 더 깊음 → total 더 큼
    const totalAt215 = qfTotal(lifetimeC);
    // 이미 41 청구했다고 가정(2번째 상전이) → gain = total − 41.
    const preview = previewPrestige(21.5, 1, lifetimeC, 41)!;
    const reset = applyPrestigeReset(preview, D(41), 1, seedBought);
    // QF = 이전 41 + gain = total.
    expect(reset.QF.eq(totalAt215)).toBe(true);
    expect(reset.qfClaimed.eq(totalAt215)).toBe(true);
    expect(reset.count).toBe(2);
  });
});

describe('부스트 — 상전이 후 production_mult (economy §1.1)', () => {
  it('QF=41 → mult = 1 + 0.25·log₁₀(42)', () => {
    const exact = D(1).add(D(0.25).mul(D(42).log10()));
    expect(productionMult(D(41)).eq(exact)).toBe(true);
    // ≈ 1.405 (PT1 후 부스트, economy §1.2 PT2 진입 mult 1.406과 근사).
    expect(productionMult(D(41)).toNumber()).toBeCloseTo(1.405, 2);
  });

  it('QF 0(상전이 전) → mult 1.0', () => {
    expect(productionMult(ZERO).eq(1)).toBe(true);
  });
});

describe('상태머신 — game.ts executePrestige (런 → dec19 → 프리온 진입)', () => {
  // game.ts는 브라우저 의존(rAF·storage)이라 Game 인스턴스 대신 상태 모듈 + 순수 함수로 통합 검증.
  // (executePrestige의 상태 변환 로직을 동일 절차로 재현 — 결정성·리셋 매트릭스 정합.)
  beforeEach(() => {
    setState(createInitialState());
  });

  it('상전이 전: dec19 미만이면 불가', () => {
    const s = getState();
    s.resources.C = cAtDec(15);
    s.resources.lifetime_C = cAtDec(15);
    const dec = computeDec(s.resources.C);
    expect(isPrestigeAvailable(dec, s.prestige.count)).toBe(false);
  });

  it('dec19 도달 → 상전이 실행 → 프리온 진입 + QF 41 + 리셋', () => {
    const s = getState();
    // dec19 도달 상태 세팅(C·lifetime_C 동일 = 첫 런).
    s.resources.C = cAtDec(19);
    s.resources.lifetime_C = cAtDec(19);
    s.resources.E = D('1e20'); // 리셋 확인용 임의 E.
    s.chain.bought = [50, 30, 10, 0, 0, 0, 0, 0]; // 리셋 확인용 보유.
    s.codex.discovered.add('water'); // 도감 보존 확인용.

    const dec = computeDec(s.resources.C);
    const preview = previewPrestige(dec, s.prestige.count, s.resources.lifetime_C, s.prestige.qfClaimed);
    expect(preview).not.toBeNull();
    expect(preview!.qfGain.eq(41)).toBe(true);

    // 리셋 매트릭스 적용(executePrestige 절차 재현).
    const lifetimeCBefore = s.resources.lifetime_C;
    const reset = applyPrestigeReset(preview!, s.resources.QF, s.prestige.count, seedBought);
    s.resources.E = reset.E;
    s.resources.C = reset.C;
    s.chain.bought = reset.bought;
    s.chain.produced = reset.produced;
    s.resources.D_current = ZERO;
    s.resources.QF = reset.QF;
    s.prestige.qfClaimed = reset.qfClaimed;
    s.prestige.count = reset.count;
    s.layers.currentIndex = reset.layerIndex;

    // --- 검증: 리셋 ---
    expect(s.resources.E.eq(0)).toBe(true);
    expect(s.resources.C.eq(0)).toBe(true);
    expect(s.chain.bought).toEqual(seedBought());
    // --- 검증: 보존 (lifetime_C·QF·도감) ---
    expect(s.resources.lifetime_C.eq(lifetimeCBefore)).toBe(true); // lifetime_C 불변(보존).
    expect(s.resources.QF.eq(41)).toBe(true);
    expect(s.codex.discovered.has('water')).toBe(true); // 도감 보존.
    // --- 검증: 진입·횟수 ---
    expect(s.layers.currentIndex).toBe(6); // 프리온.
    expect(s.prestige.count).toBe(1);
    // --- 검증: 부스트 적용 ---
    expect(productionMult(s.resources.QF).toNumber()).toBeCloseTo(1.405, 2);
  });
});

describe('세이브 라운드트립 — prestige 상태 보존 + 결정성', () => {
  it('count·qfClaimed·currentIndex(프리온) 직렬화 라운드트립', () => {
    const s = createInitialState();
    s.prestige.count = 1;
    s.prestige.qfClaimed = D(41);
    s.resources.QF = D(41);
    s.resources.lifetime_C = cAtDec(19);
    s.layers.currentIndex = 6; // 프리온 진입 상태.
    s.prestige.offlineBonusPending = true;

    const data = serializeState(s);
    const restored = deserializeState(data);

    expect(restored.prestige.count).toBe(1);
    expect(restored.prestige.qfClaimed.eq(41)).toBe(true);
    expect(restored.resources.QF.eq(41)).toBe(true);
    expect(restored.resources.lifetime_C.eq(cAtDec(19))).toBe(true);
    expect(restored.layers.currentIndex).toBe(6);
    expect(restored.prestige.offlineBonusPending).toBe(true);
  });

  it('결정성: 같은 lifetime_C → 같은 QF(재현 가능)', () => {
    const lc = cAtDec(19);
    const a = qfTotal(lc);
    const b = qfTotal(lc);
    expect(a.eq(b)).toBe(true);
    expect(a.eq(41)).toBe(true);
  });
});
