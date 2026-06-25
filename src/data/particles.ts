/**
 * data/particles — 입자 도감 데이터 (데이터 주도). (codex.md §2-8, data-spec.md §2, narrative.md §3)
 *
 * M1.3 범위: **알려진 물리 57입자**(분자8 + 원자13 + 핵10 + 핵자9 + 쿼크17).
 * M1.6 추가: **미지 프리온 7 + 끈 6 = 13입자**(L6·L7). 첫 두 미지 서브층 도감. 나머지 미지
 *   17입자(L8~L11)는 후속. 전체 87 중 현재 70 정의.
 *
 * ★ 발견 조건(층별 분기):
 *   - **알려진 물리(L1~L5)**: dec 임계값(unlockDec) 기반 발견(층 진입 후 점진). codex 모듈이 판정.
 *   - **미지(L6 프리온·L7 끈)**: 상전이 후 C 리셋으로 dec=0이라 dec 게이트 부적합 →
 *     **메커니즘 상태 기반 발견**(game.ts가 판정). 프리온 P+/P-/P0 = 위상 상태별 누적 시간 임계
 *     (systems §2-E), 끈 = 하모닉 공명 횟수 임계(systems §2-F). unlockDec는 "그 층 진입" 표식으로만
 *     해당 층 enterDec 값을 두되(dec 게이트엔 안 걸림 — discoverable이지만 codex 모듈이 layer>5는 스킵),
 *     실제 해금은 game.ts 메커니즘 경로가 담당. 발견 임계는 mechGate 필드로 표현.
 *   - 원문 unlockCondition은 표시·보존(unlockConditionKo). rarity·물리값은 codex 원문 그대로.
 *
 * 출처(임의 변경 금지): codex.md §2~§6(알려진 물리)·§7(프리온)·§8(끈). 물리값 = PDG / 미지는 설계 가설.
 *   flavorKo는 codex flavor_brief(narrative §3 보이스) 요약 — 최종 플레이버는 locale 패스(M3).
 */

import { layerById } from './layers';

/** 희귀도 등급(codex.md §1, data-spec §2-A). LEGENDARY = 층 완성 보너스(자동 해금, discoverable=false). */
export type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

/**
 * 미지 서브층 메커니즘 발견 게이트(M1.6). game.ts가 메커니즘 상태로 발견을 판정한다.
 *  - phase: 위상 상태(state)를 누적 seconds초 유지(프리온 L6, systems §2-E).
 *  - harmonic: 하모닉 공명 resonances회 발생(끈 L7, systems §2-F).
 *  - decade: 추가 압축으로 dec가 dec값 도달(미지 층 내 후반 입자 — 위상 진공·매듭 등).
 *  - layerComplete: 해당 층 discoverable 전부 발견 시(LEGENDARY 완성 보너스).
 */
export type MechGate =
  | { kind: 'phase'; state: 'coherent' | 'dispersed' | 'resonant'; seconds: number }
  | { kind: 'harmonic'; resonances: number }
  | { kind: 'decade'; dec: number }
  | { kind: 'layerComplete' };

/** 입자 도감 엔트리(런타임 형태). codex.md §1 스키마 + M1.3 발견 게이트. */
export interface Particle {
  /** 코드 식별자(snake_case, 전체 고유). */
  id: string;
  /** 표시 이름(기호·화학식 포함). */
  name: string;
  /** 한국어 이름. */
  nameKo: string;
  /** 속한 층 번호(1..11). */
  layer: number;
  /** 크기(m, 과학 표기 문자열 또는 "<1e-18"). */
  scaleM: string;
  /** 서사 decade 값(codex decade). */
  decade: number;
  /** 실제 물리 입자 여부. M1.3은 전부 true(알려진 물리). */
  real: boolean;
  /** 질량(eV/c², 문자열). null = 완성 보너스 등 해당없음. */
  massEv: string | null;
  /** 전하(e 단위). null = 완성 보너스. */
  charge: number | null;
  /** 스핀(ℏ 단위). null = 완성 보너스. */
  spin: number | null;
  /** 희귀도. */
  rarity: Rarity;
  /**
   * 발견 게이트 dec(M1.3). 현재 dec ≥ unlockDec 이면 발견(codex 모듈이 판정).
   * 층 진입(enterDec) 이상 + 층 내 점진 분산. LEGENDARY는 층 완성(전 입자 발견) 시 별도 해금.
   */
  unlockDec: number;
  /** 홀로그래픽 완성도 분모 포함 여부(LEGENDARY=false, data-spec §2-C). */
  discoverable: boolean;
  /**
   * 미지 서브층(L6+) 메커니즘 발견 게이트(M1.6). 알려진 물리(L1~L5)는 undefined(dec 게이트 사용).
   * 미지 입자는 상전이 후 dec=0이라 dec 게이트 부적합 → 메커니즘 상태로 발견(game.ts가 판정).
   *  - 프리온(L6): { kind:'phase', state, seconds } — 위상 상태 누적 N초(systems §2-E).
   *  - 끈(L7):    { kind:'harmonic', resonances } — 하모닉 공명 N회(systems §2-F).
   *  - 층 완성(LEGENDARY) / decade 기반 입자: { kind:'layerComplete' } 또는 undefined(생략).
   */
  mechGate?: MechGate;
  /** codex 원문 발견 조건(표시·M1.4 재구현용 보존). */
  unlockConditionKo: string;
  /** 발견 보너스 종류(자유 서술, 수치는 economy — M1.3 미적용). */
  unlockBonusKo: string;
  /** 플레이버(narrative §3 보이스, 1~2문장). */
  flavorKo: string;
}

/**
 * L1 분자층 (dec0~1). 8입자. codex.md §2.
 * 발견 분산: dec0(시작)~dec1(원자 진입 직전)에 8개. RARE 2개는 dec0.8~0.95(층 끝물).
 */
const MOLECULE: Particle[] = [
  {
    id: 'water_molecule', name: 'H₂O', nameKo: '물 분자', layer: 1,
    scaleM: '2.75e-10', decade: 0, real: true, massEv: '1.675e10', charge: 0, spin: 0,
    rarity: 'COMMON', unlockDec: 0, discoverable: true,
    unlockConditionKo: '게임 시작 — 압축 깊이 C > 0',
    unlockBonusKo: 'T1 압축기 비용 소폭 할인 (초기 진입 윤활)',
    flavorKo: '시작의 분자. 압축 실험실의 첫 표본.',
  },
  {
    id: 'co2_molecule', name: 'CO₂', nameKo: '이산화탄소 분자', layer: 1,
    scaleM: '5.0e-10', decade: 0, real: true, massEv: '4.08e10', charge: 0, spin: 0,
    rarity: 'COMMON', unlockDec: 0.15, discoverable: true,
    unlockConditionKo: 'C가 첫 번째 마일스톤 도달',
    unlockBonusKo: 'E(에너지) 생산율 소폭 상승',
    flavorKo: '선형 분자. 압축할수록 탄소의 진실이 드러나기 시작.',
  },
  {
    id: 'n2_molecule', name: 'N₂', nameKo: '질소 분자', layer: 1,
    scaleM: '3.64e-10', decade: 0, real: true, massEv: '2.61e10', charge: 0, spin: 0,
    rarity: 'COMMON', unlockDec: 0.3, discoverable: true,
    unlockConditionKo: 'T2 압축기 첫 구매',
    unlockBonusKo: 'D(발견 데이터) 트리클 증가',
    flavorKo: '대기의 78%. 압축하면 질소가 먼저 비밀을 내놓는다.',
  },
  {
    id: 'o2_molecule', name: 'O₂', nameKo: '산소 분자', layer: 1,
    scaleM: '3.46e-10', decade: 0, real: true, massEv: '2.99e10', charge: 0, spin: 1,
    rarity: 'COMMON', unlockDec: 0.45, discoverable: true,
    unlockConditionKo: 'T3 압축기 첫 구매',
    unlockBonusKo: '압축 클릭 파워 소폭 증가',
    flavorKo: '스핀=1. 파라마그네틱 산소의 진동이 느껴진다.',
  },
  {
    id: 'nacl_molecule', name: 'NaCl', nameKo: '염화나트륨 (소금)', layer: 1,
    scaleM: '5.6e-10', decade: 0, real: true, massEv: '5.41e10', charge: 0, spin: 0,
    rarity: 'UNCOMMON', unlockDec: 0.6, discoverable: true,
    unlockConditionKo: '오비탈 공명 3회 성공',
    unlockBonusKo: '체인 T1·T2 동시 배율 소폭 상승 (이온 결합 시너지)',
    flavorKo: '이온 결합의 걸작. 두 원소가 전자를 주고받는 순간.',
  },
  {
    id: 'glucose_molecule', name: 'C₆H₁₂O₆', nameKo: '포도당 분자', layer: 1,
    scaleM: '9.0e-10', decade: 0, real: true, massEv: '1.68e11', charge: 0, spin: 0,
    rarity: 'UNCOMMON', unlockDec: 0.72, discoverable: true,
    unlockConditionKo: 'D 누적 임계 도달',
    unlockBonusKo: '방치 중 D 트리클 추가 증가 (복잡성 보상)',
    flavorKo: '생명 에너지의 화폐. 24개 원자가 하나의 고리를 만든다.',
  },
  {
    id: 'dna_fragment', name: 'DNA 이중나선 단편', nameKo: 'DNA 이중나선 단편', layer: 1,
    scaleM: '2.0e-9', decade: 0, real: true, massEv: null, charge: -1, spin: 0,
    rarity: 'RARE', unlockDec: 0.85, discoverable: true,
    unlockConditionKo: 'L1 도감 6개 완료',
    unlockBonusKo: '연구 트리 Branch-C 첫 노드 비용 할인 (자동화 암시)',
    flavorKo: '정보가 물질로 새겨진 최초의 증거. 압축의 목적지를 예고한다.',
  },
  {
    id: 'buckyball', name: 'C₆₀ (버키볼)', nameKo: '풀러렌-60', layer: 1,
    scaleM: '1.0e-9', decade: 0, real: true, massEv: '8.48e11', charge: 0, spin: 0,
    rarity: 'RARE', unlockDec: 0.95, discoverable: true,
    unlockConditionKo: 'L1 도감 완성 (8/8)',
    unlockBonusKo: 'L1 완성 보너스 — 다음 상전이 QF 획득량 소폭 증가',
    flavorKo: '60개 탄소의 완벽한 구. 분자 건축의 정점에서, 원자의 세계가 열린다.',
  },
];

/**
 * L2 원자층 (dec1~5). 13입자(완성보너스 1 포함). codex.md §3.
 * 발견 분산: dec1(진입)~dec4.8. l2_completion(LEGENDARY)은 12개 발견 시 별도 해금.
 */
const ATOM: Particle[] = [
  {
    id: 'hydrogen_atom', name: '¹H', nameKo: '수소 원자', layer: 2,
    scaleM: '1.2e-10', decade: 1, real: true, massEv: '9.389e8', charge: 1, spin: 0.5,
    rarity: 'COMMON', unlockDec: 1, discoverable: true,
    unlockConditionKo: 'decade 1 진입 즉시',
    unlockBonusKo: '오비탈 공명 기본 배율 소폭 상승',
    flavorKo: '우주에서 가장 단순한 원자. 하나의 양성자, 하나의 전자.',
  },
  {
    id: 'helium_atom', name: '⁴He', nameKo: '헬륨 원자', layer: 2,
    scaleM: '1.4e-10', decade: 1, real: true, massEv: '3.728e9', charge: 0, spin: 0,
    rarity: 'COMMON', unlockDec: 1.4, discoverable: true,
    unlockConditionKo: '오비탈 공명 첫 성공',
    unlockBonusKo: '방치 시 자동 공명 주기 단축',
    flavorKo: '닫힌 껍질. 아무것도 반응하지 않는 귀족.',
  },
  {
    id: 'carbon_atom', name: '¹²C', nameKo: '탄소-12 원자', layer: 2,
    scaleM: '1.54e-10', decade: 1, real: true, massEv: '1.116e10', charge: 6, spin: 0,
    rarity: 'COMMON', unlockDec: 1.8, discoverable: true,
    unlockConditionKo: 'T4 압축기 첫 구매',
    unlockBonusKo: 'D 트리클 증가 (탄소 = 생명·정보의 기반)',
    flavorKo: '4개의 결합손. 생명의 뼈대이자 연료의 심장.',
  },
  {
    id: 'oxygen_atom', name: '¹⁶O', nameKo: '산소-16 원자', layer: 2,
    scaleM: '1.52e-10', decade: 1, real: true, massEv: '1.492e10', charge: 8, spin: 0,
    rarity: 'COMMON', unlockDec: 2.2, discoverable: true,
    unlockConditionKo: '오비탈 공명 10회 성공',
    unlockBonusKo: '공명 지속 시간 소폭 연장',
    flavorKo: '전자 2개가 비어있다. 그 빈자리가 세상을 움직인다.',
  },
  {
    id: 'electron', name: 'e⁻', nameKo: '전자', layer: 2,
    scaleM: '<1e-18', decade: 1, real: true, massEv: '5.109e5', charge: -1, spin: 0.5,
    rarity: 'UNCOMMON', unlockDec: 2.6, discoverable: true,
    unlockConditionKo: '오비탈 공명으로 전자 전이 로그 5회 기록',
    unlockBonusKo: '오비탈 공명 클릭 보너스 배율 증가 (전자 발견 = 공명 이해)',
    flavorKo: '가장 작은 전하 단위. 오비탈을 도는 파동이자 입자.',
  },
  {
    id: 'proton', name: 'p⁺', nameKo: '양성자', layer: 2,
    scaleM: '8.41e-16', decade: 1, real: true, massEv: '9.383e8', charge: 1, spin: 0.5,
    rarity: 'UNCOMMON', unlockDec: 3.0, discoverable: true,
    unlockConditionKo: 'decade 1에서 C가 두 번째 마일스톤 도달',
    unlockBonusKo: '체인 T2 배율 소폭 증가 (핵자 예고)',
    flavorKo: '전자보다 1836배 무겁다. 핵의 중심을 지키는 기둥.',
  },
  {
    id: 'neutron', name: 'n⁰', nameKo: '중성자', layer: 2,
    scaleM: '8.0e-16', decade: 1, real: true, massEv: '9.396e8', charge: 0, spin: 0.5,
    rarity: 'UNCOMMON', unlockDec: 3.4, discoverable: true,
    unlockConditionKo: '양성자 발견 후 오비탈 공명 20회 성공',
    unlockBonusKo: '핵층 진입 시 핵력 게이지 초기 충전량 증가',
    flavorKo: '전하 없는 핵자. 13분 후 붕괴 — 자유로운 중성자는 오래 살지 못한다.',
  },
  {
    id: 'iron_atom', name: '⁵⁶Fe', nameKo: '철-56 원자', layer: 2,
    scaleM: '1.56e-10', decade: 1, real: true, massEv: '5.214e10', charge: 26, spin: 0,
    rarity: 'RARE', unlockDec: 3.8, discoverable: true,
    unlockConditionKo: 'L2 도감 7개 완료 + 핵결합 에너지 개념 해금',
    unlockBonusKo: '핵층 진입 QF 획득량 증가 (가장 안정된 핵 — 핵력 보상)',
    flavorKo: '핵결합 에너지의 정점. 철보다 무거운 원소는 별이 죽을 때만 만들어진다.',
  },
  {
    id: 'uranium_atom', name: '²³⁵U', nameKo: '우라늄-235 원자', layer: 2,
    scaleM: '1.75e-10', decade: 1, real: true, massEv: '2.190e11', charge: 92, spin: 3.5,
    rarity: 'RARE', unlockDec: 4.1, discoverable: true,
    unlockConditionKo: 'L2 도감 8개 완료 (철 발견 필요)',
    unlockBonusKo: '핵력 게이지 최대치 소폭 증가 (불안정 핵 = 더 큰 에너지)',
    flavorKo: '92개의 양성자. 이것은 분열을 기다리는 에너지의 화산이다.',
  },
  {
    id: 'photon', name: 'γ (광자)', nameKo: '광자', layer: 2,
    scaleM: '0', decade: 1, real: true, massEv: '0', charge: 0, spin: 1,
    rarity: 'EPIC', unlockDec: 4.4, discoverable: true,
    unlockConditionKo: '전자 발견 후 오비탈 전이 이벤트 25회',
    unlockBonusKo: '오비탈 공명 D 획득 보너스 증가 (광자 방출 = 데이터)',
    flavorKo: '질량 없는 보손. 전자가 껍질을 내려올 때마다 빛이 태어난다.',
  },
  {
    id: 'muon', name: 'μ⁻', nameKo: '뮤온', layer: 2,
    scaleM: '<1e-18', decade: 1, real: true, massEv: '1.057e8', charge: -1, spin: 0.5,
    rarity: 'EPIC', unlockDec: 4.6, discoverable: true,
    unlockConditionKo: 'L2 도감 9개 완료 + 공명 50회',
    unlockBonusKo: '2세대 렙톤 카테고리 해금 — 다음 희귀 발견 D 보너스 2배',
    flavorKo: '전자의 207배 무거운 사촌. 2.2μs만 살다 사라진다. 왜 존재하는가?',
  },
  {
    id: 'electron_neutrino', name: 'νₑ', nameKo: '전자 중성미자', layer: 2,
    scaleM: '<1e-18', decade: 1, real: true, massEv: '<2.0', charge: 0, spin: 0.5,
    rarity: 'EPIC', unlockDec: 4.8, discoverable: true,
    unlockConditionKo: "연구 트리 Branch-D '렙톤 감지' 노드 구매 후 L2 완성",
    unlockBonusKo: '방치 D 트리클 증가 (상호작용 없이 통과하는 입자 = 방치 보상)',
    flavorKo: '1초에 수조 개가 당신을 통과한다. 아무것도 느끼지 못하면서.',
  },
  {
    id: 'l2_completion', name: 'L2 완성 — 원자 도감', nameKo: '원자 주기율 완성', layer: 2,
    scaleM: '0', decade: 1, real: true, massEv: null, charge: null, spin: null,
    rarity: 'LEGENDARY', unlockDec: 5, discoverable: false,
    unlockConditionKo: 'L2 도감 12/12 완성',
    unlockBonusKo: '전자 오비탈 공명 자동화 연구 비용 대폭 할인 (층 완성 보상)',
    flavorKo: '원자의 지도가 완성됐다. 이제 그 안으로 들어갈 차례.',
  },
];

/**
 * L3 핵층 (dec5~6). 10입자(완성보너스 1 포함). codex.md §4.
 * 발견 분산: dec5(진입)~dec5.9. l3_completion(LEGENDARY)은 9개 발견 시 별도 해금.
 */
const NUCLEUS: Particle[] = [
  {
    id: 'alpha_particle', name: 'α 입자', nameKo: '알파 입자 (⁴He 핵)', layer: 3,
    scaleM: '1.7e-15', decade: 5, real: true, massEv: '3.727e9', charge: 2, spin: 0,
    rarity: 'COMMON', unlockDec: 5, discoverable: true,
    unlockConditionKo: 'decade 5 진입 즉시',
    unlockBonusKo: '핵력 게이지 충전 속도 소폭 증가',
    flavorKo: '헬륨-4 핵. 방사성 붕괴의 가장 흔한 산물.',
  },
  {
    id: 'deuteron', name: 'd (중수소 핵)', nameKo: '중양성자', layer: 3,
    scaleM: '2.1e-15', decade: 5, real: true, massEv: '1.876e9', charge: 1, spin: 1,
    rarity: 'COMMON', unlockDec: 5.1, discoverable: true,
    unlockConditionKo: '핵력 게이지 첫 만충',
    unlockBonusKo: '핵결합 이벤트 쿨다운 소폭 단축',
    flavorKo: '양성자 하나, 중성자 하나. 핵융합의 가장 쉬운 연료.',
  },
  {
    id: 'triton', name: 't (삼중수소 핵)', nameKo: '삼중양성자', layer: 3,
    scaleM: '1.9e-15', decade: 5, real: true, massEv: '2.809e9', charge: 1, spin: 0.5,
    rarity: 'COMMON', unlockDec: 5.2, discoverable: true,
    unlockConditionKo: '핵결합 이벤트 3회',
    unlockBonusKo: '핵결합 이벤트 QF 미적립 증가',
    flavorKo: '12.3년이 지나면 헬륨-3으로 변한다. 불안정한 핵의 운명.',
  },
  {
    id: 'carbon12_nucleus', name: '¹²C 핵', nameKo: '탄소-12 원자핵', layer: 3,
    scaleM: '2.7e-15', decade: 5, real: true, massEv: '1.116e10', charge: 6, spin: 0,
    rarity: 'UNCOMMON', unlockDec: 5.35, discoverable: true,
    unlockConditionKo: '게이지 충전 5회 + 탄소 원자 기발견',
    unlockBonusKo: '체인 T3 배율 소폭 증가',
    flavorKo: '탄소-12 핵. 원자질량 단위의 기준점.',
  },
  {
    id: 'uranium235_nucleus', name: '²³⁵U 핵', nameKo: '우라늄-235 원자핵', layer: 3,
    scaleM: '7.4e-15', decade: 5, real: true, massEv: '2.190e11', charge: 92, spin: 3.5,
    rarity: 'UNCOMMON', unlockDec: 5.5, discoverable: true,
    unlockConditionKo: '우라늄 원자 기발견 + 게이지 10회',
    unlockBonusKo: '핵결합 이벤트 C 생산 스파이크 배율 증가',
    flavorKo: '느린 중성자 하나가 이것을 쪼개면 연쇄 붕괴가 시작된다.',
  },
  {
    id: 'fe56_nucleus', name: '⁵⁶Fe 핵', nameKo: '철-56 원자핵', layer: 3,
    scaleM: '4.6e-15', decade: 5, real: true, massEv: '5.214e10', charge: 26, spin: 0,
    rarity: 'UNCOMMON', unlockDec: 5.6, discoverable: true,
    unlockConditionKo: '철 원자 기발견 + 핵결합 에너지 개념 확인 (게이지 15회)',
    unlockBonusKo: '핵층 완성 도감 보너스 전제 조건 충족',
    flavorKo: '핵자당 결합 에너지 최대치. 이 이상은 융합도 분열도 에너지를 내지 않는다.',
  },
  {
    id: 'nuclear_isomer', name: '핵이성질체 (isomer)', nameKo: '핵이성질체', layer: 3,
    scaleM: '5.0e-15', decade: 5, real: true, massEv: null, charge: null, spin: null,
    rarity: 'RARE', unlockDec: 5.7, discoverable: true,
    unlockConditionKo: '게이지 만충 20회 (충전→이벤트 루프의 숙련)',
    unlockBonusKo: '핵결합 이벤트 시 도감 D 보너스 추가 지급',
    flavorKo: '같은 핵자 수, 다른 에너지 상태. 핵도 들뜰 수 있다.',
  },
  {
    id: 'pion_charged', name: 'π⁺ / π⁻', nameKo: '하전 파이온', layer: 3,
    scaleM: '<1e-18', decade: 5, real: true, massEv: '1.396e8', charge: 1, spin: 0,
    rarity: 'RARE', unlockDec: 5.8, discoverable: true,
    unlockConditionKo: '핵력 게이지 과충전 연구 노드 구매 후 게이지 30회',
    unlockBonusKo: '강력 매개 보손 카테고리 해금 — 핵자층 보너스 증가',
    flavorKo: '양성자와 중성자를 묶는 접착제. 핵력의 실제 전달자.',
  },
  {
    id: 'pion_neutral', name: 'π⁰', nameKo: '중성 파이온', layer: 3,
    scaleM: '<1e-18', decade: 5, real: true, massEv: '1.350e8', charge: 0, spin: 0,
    rarity: 'RARE', unlockDec: 5.9, discoverable: true,
    unlockConditionKo: '하전 파이온 발견 후 게이지 이벤트 40회',
    unlockBonusKo: '핵층→핵자층 상전이 QF 보너스 증가',
    flavorKo: '8.4×10⁻¹⁷초 만에 두 광자로 붕괴. 가장 짧은 삶.',
  },
  {
    id: 'l3_completion', name: 'L3 완성 — 핵종 도감', nameKo: '핵종 차트 완성', layer: 3,
    scaleM: '0', decade: 5, real: true, massEv: null, charge: null, spin: null,
    rarity: 'LEGENDARY', unlockDec: 6, discoverable: false,
    unlockConditionKo: 'L3 도감 9/9 완성',
    unlockBonusKo: '핵자층 진입 시 색전하 삼원합일 초기 균형 보너스 제공',
    flavorKo: '핵의 모든 얼굴을 봤다. 이제 핵 안으로 들어갈 차례.',
  },
];

/**
 * L4 핵자층 (dec6~9). 9입자(완성보너스 1 포함). codex.md §5.
 * 발견 분산: dec6(진입)~dec8.5. l4_completion(LEGENDARY)은 8개 발견 시 별도 해금.
 */
const HADRON: Particle[] = [
  {
    id: 'proton_nucleon', name: 'p⁺ (핵자)', nameKo: '양성자 (핵자로서)', layer: 4,
    scaleM: '8.41e-16', decade: 6, real: true, massEv: '9.383e8', charge: 1, spin: 0.5,
    rarity: 'COMMON', unlockDec: 6, discoverable: true,
    unlockConditionKo: 'decade 6 진입 즉시',
    unlockBonusKo: '색전하 균형 임계값 소폭 완화 (양성자 이해 = 색 균형 이해)',
    flavorKo: 'uud 쿼크 세 개. 전하 +1은 이 조합에서 나온다.',
  },
  {
    id: 'neutron_nucleon', name: 'n⁰ (핵자)', nameKo: '중성자 (핵자로서)', layer: 4,
    scaleM: '8.0e-16', decade: 6, real: true, massEv: '9.396e8', charge: 0, spin: 0.5,
    rarity: 'COMMON', unlockDec: 6.3, discoverable: true,
    unlockConditionKo: '삼원합일 첫 성공',
    unlockBonusKo: '하드론 합성 보너스 지속 시간 소폭 증가',
    flavorKo: 'udd 쿼크 세 개. 전하 0은 +2/3 둘과 −1/3 둘의 상쇄.',
  },
  {
    id: 'delta_resonance', name: 'Δ (델타 공명 입자)', nameKo: '델타 공명 입자', layer: 4,
    scaleM: '<1e-15', decade: 6, real: true, massEv: '1.232e9', charge: 2, spin: 1.5,
    rarity: 'UNCOMMON', unlockDec: 6.7, discoverable: true,
    unlockConditionKo: '삼원합일 퍼펙트 균형 5회',
    unlockBonusKo: '삼원합일 퍼펙트 보너스 배율 증가',
    flavorKo: '가장 가벼운 바리온 공명 입자. 5.6×10⁻²⁴초만 존재한다.',
  },
  {
    id: 'lambda_baryon', name: 'Λ⁰ (람다 바리온)', nameKo: '람다 바리온', layer: 4,
    scaleM: '<1e-15', decade: 6, real: true, massEv: '1.116e9', charge: 0, spin: 0.5,
    rarity: 'UNCOMMON', unlockDec: 7.1, discoverable: true,
    unlockConditionKo: '삼원합일 10회 + D 보유',
    unlockBonusKo: '이상 쿼크 (s) 카테고리 해금 — 쿼크층 보너스 전제 충족',
    flavorKo: 'uds 쿼크. 낯선 맛(strangeness = −1)을 가진 첫 하이퍼론.',
  },
  {
    id: 'kaon_charged', name: 'K⁺ / K⁻', nameKo: '하전 케이온', layer: 4,
    scaleM: '<1e-15', decade: 6, real: true, massEv: '4.937e8', charge: 1, spin: 0,
    rarity: 'RARE', unlockDec: 7.5, discoverable: true,
    unlockConditionKo: '람다 바리온 발견 후 삼원합일 20회',
    unlockBonusKo: '메손 카테고리 해금 — 파이온 D 보너스 소급 증가',
    flavorKo: '가장 가벼운 이상 메손. CP 대칭 붕괴를 처음 보여준 입자.',
  },
  {
    id: 'omega_baryon', name: 'Ω⁻ (오메가 바리온)', nameKo: '오메가 바리온', layer: 4,
    scaleM: '<1e-15', decade: 6, real: true, massEv: '1.672e9', charge: -1, spin: 1.5,
    rarity: 'RARE', unlockDec: 7.8, discoverable: true,
    unlockConditionKo: 'L4 도감 4개 완료 + 삼원합일 30회',
    unlockBonusKo: '색 전문화 연구 노드 비용 할인 (세 이상 쿼크 = 전문화 예고)',
    flavorKo: 'sss 세 이상 쿼크. 1964년 발견 예측, 실험 확인 = 쿼크 모델의 승리.',
  },
  {
    id: 'eta_meson', name: 'η 메손', nameKo: '에타 메손', layer: 4,
    scaleM: '<1e-15', decade: 6, real: true, massEv: '5.479e8', charge: 0, spin: 0,
    rarity: 'RARE', unlockDec: 8.1, discoverable: true,
    unlockConditionKo: '삼원합일 퍼펙트 15회',
    unlockBonusKo: 'QF 트리클 소폭 증가 (중성 메손 = 상전이 예고)',
    flavorKo: 'ūu, dd̄, ss̄ 의 혼합. 순수한 이론이 만들어낸 중첩 상태.',
  },
  {
    id: 'gluon', name: 'g (글루온)', nameKo: '글루온', layer: 4,
    scaleM: '0', decade: 6, real: true, massEv: '0', charge: 0, spin: 1,
    rarity: 'EPIC', unlockDec: 8.5, discoverable: true,
    unlockConditionKo: 'L4 도감 6개 완료 + 색전하 삼원합일 50회 (강력의 전달자)',
    unlockBonusKo: '삼원합일 균형 임계값 대폭 완화 + 색전하 분배 연구 비용 할인',
    flavorKo: '강력의 매개 보손. 8종. 색전하를 교환하며 쿼크를 묶는다.',
  },
  {
    id: 'l4_completion', name: 'L4 완성 — 하드론 도감', nameKo: '하드론 동물원 완성', layer: 4,
    scaleM: '0', decade: 6, real: true, massEv: null, charge: null, spin: null,
    rarity: 'LEGENDARY', unlockDec: 9, discoverable: false,
    unlockConditionKo: 'L4 도감 8/8 완성',
    unlockBonusKo: '쿼크층 진입 시 점근 자유 가속 첫 발동 임계값 대폭 감소 (빠른 도약)',
    flavorKo: '하드론 동물원을 완전히 기록했다. 이제 쿼크 자체를 해방시킬 시간.',
  },
];

/**
 * L5 쿼크층 (dec9~19, 쿼크 꼬리). 17입자(완성보너스 1 포함). codex.md §6.
 * 발견 분산: dec9(진입)~dec18(미지 진입 직전). 알려진 물리의 가장 긴 대역.
 * l5_completion(LEGENDARY)은 16개 발견 시 별도 해금(표준모형 완성).
 */
const QUARK: Particle[] = [
  {
    id: 'up_quark', name: 'u (업 쿼크)', nameKo: '업 쿼크', layer: 5,
    scaleM: '<1e-18', decade: 9, real: true, massEv: '2.2e6', charge: 0.667, spin: 0.5,
    rarity: 'COMMON', unlockDec: 9, discoverable: true,
    unlockConditionKo: 'decade 9 진입 즉시 (1세대 쿼크)',
    unlockBonusKo: '점근 자유 발동 임계값 소폭 감소 (빠른 발동)',
    flavorKo: '가장 가벼운 업타입 쿼크. 양성자의 두 주인공 중 하나.',
  },
  {
    id: 'down_quark', name: 'd (다운 쿼크)', nameKo: '다운 쿼크', layer: 5,
    scaleM: '<1e-18', decade: 9, real: true, massEv: '4.7e6', charge: -0.333, spin: 0.5,
    rarity: 'COMMON', unlockDec: 9.5, discoverable: true,
    unlockConditionKo: '점근 자유 첫 발동',
    unlockBonusKo: '점근 자유 지속 시간 소폭 증가',
    flavorKo: '가장 가벼운 다운타입 쿼크. 중성자의 주인공.',
  },
  {
    id: 'strange_quark', name: 's (이상 쿼크)', nameKo: '이상 쿼크', layer: 5,
    scaleM: '<1e-18', decade: 9, real: true, massEv: '9.3e7', charge: -0.333, spin: 0.5,
    rarity: 'UNCOMMON', unlockDec: 10, discoverable: true,
    unlockConditionKo: '점근 자유 5회 + 람다 바리온 기발견',
    unlockBonusKo: '2세대 쿼크 카테고리 해금 — 다음 쿼크 D 보너스 증가',
    flavorKo: '낯선 맛(strangeness). 우주의 물질이 이것을 쥐고 잠시 머물렀다.',
  },
  {
    id: 'charm_quark', name: 'c (맵시 쿼크)', nameKo: '맵시 쿼크', layer: 5,
    scaleM: '<1e-18', decade: 9, real: true, massEv: '1.28e9', charge: 0.667, spin: 0.5,
    rarity: 'UNCOMMON', unlockDec: 10.5, discoverable: true,
    unlockConditionKo: '점근 자유 10회',
    unlockBonusKo: '점근 자유 α 감소 효과 소폭 강화',
    flavorKo: "1974년 발견. 쿼크 모델의 완전한 승리를 선언한 '11월 혁명'.",
  },
  {
    id: 'bottom_quark', name: 'b (바닥 쿼크)', nameKo: '바닥 쿼크', layer: 5,
    scaleM: '<1e-18', decade: 9, real: true, massEv: '4.18e9', charge: -0.333, spin: 0.5,
    rarity: 'RARE', unlockDec: 11, discoverable: true,
    unlockConditionKo: '3세대 진입 연구 노드 구매 + 점근 자유 20회',
    unlockBonusKo: '3세대 쿼크 카테고리 해금 — D 생산 증가',
    flavorKo: '3세대의 다운타입. 탑 쿼크의 짝. 1977년 페르미랩에서 발견.',
  },
  {
    id: 'top_quark', name: 't (탑 쿼크)', nameKo: '탑 쿼크', layer: 5,
    scaleM: '<1e-18', decade: 9, real: true, massEv: '1.73e11', charge: 0.667, spin: 0.5,
    rarity: 'RARE', unlockDec: 11.5, discoverable: true,
    unlockConditionKo: '바닥 쿼크 발견 후 점근 자유 30회',
    unlockBonusKo: '탑 쿼크 질량 = 금 원자 수준 → 체인 T7·T8 배율 소폭 증가',
    flavorKo: '알려진 입자 중 가장 무겁다. 173 GeV. 5×10⁻²⁵초 만에 붕괴.',
  },
  {
    id: 'tau_lepton', name: 'τ⁻ (타우 렙톤)', nameKo: '타우 렙톤', layer: 5,
    scaleM: '<1e-18', decade: 9, real: true, massEv: '1.777e9', charge: -1, spin: 0.5,
    rarity: 'UNCOMMON', unlockDec: 12, discoverable: true,
    unlockConditionKo: '3세대 쿼크 카테고리 해금 후 공명 60회',
    unlockBonusKo: '3세대 렙톤 카테고리 해금 — 뉴트리노 발견 보너스 증가',
    flavorKo: '3세대 하전 렙톤. 2.9×10⁻¹³초. 전자의 3477배 무겁다.',
  },
  {
    id: 'muon_neutrino', name: 'νμ (뮤온 중성미자)', nameKo: '뮤온 중성미자', layer: 5,
    scaleM: '<1e-18', decade: 9, real: true, massEv: '<0.17e6', charge: 0, spin: 0.5,
    rarity: 'UNCOMMON', unlockDec: 12.5, discoverable: true,
    unlockConditionKo: '뮤온 기발견 + 점근 자유 15회',
    unlockBonusKo: '방치 D 트리클 추가 증가',
    flavorKo: '뮤온과 함께 태어나고 뮤온과 함께 사라진다.',
  },
  {
    id: 'tau_neutrino', name: 'ντ (타우 중성미자)', nameKo: '타우 중성미자', layer: 5,
    scaleM: '<1e-18', decade: 9, real: true, massEv: '<18.2e6', charge: 0, spin: 0.5,
    rarity: 'RARE', unlockDec: 13, discoverable: true,
    unlockConditionKo: '타우 렙톤 발견 후 D 보유',
    unlockBonusKo: '뉴트리노 3종 완성 시 QF 트리클 증가 (3대 가족 완성)',
    flavorKo: '2000년에야 직접 검출됐다. 표준모형의 마지막 빈 칸 중 하나.',
  },
  {
    id: 'w_boson', name: 'W⁺ / W⁻', nameKo: 'W 보손', layer: 5,
    scaleM: '<2e-18', decade: 9, real: true, massEv: '8.038e10', charge: 1, spin: 1,
    rarity: 'RARE', unlockDec: 13.5, discoverable: true,
    unlockConditionKo: '약력 카테고리 연구 노드 구매 + 점근 자유 25회',
    unlockBonusKo: '상전이(프레스티지) 후 첫 런 효율 증가 (약붕괴 = 변환)',
    flavorKo: '약력의 전달자. 중성자를 양성자로 바꾸는 베타 붕괴의 주인공.',
  },
  {
    id: 'z_boson', name: 'Z⁰', nameKo: 'Z 보손', layer: 5,
    scaleM: '<2e-18', decade: 9, real: true, massEv: '9.119e10', charge: 0, spin: 1,
    rarity: 'RARE', unlockDec: 14, discoverable: true,
    unlockConditionKo: 'W 보손 발견 후 D 보유',
    unlockBonusKo: '점근 자유 α 감소 폭 증가 (중성 약력 = 저항 없는 통과)',
    flavorKo: '중성 약력 전달자. 전하를 바꾸지 않고 입자와 상호작용한다.',
  },
  {
    id: 'higgs_boson', name: 'H (힉스 보손)', nameKo: '힉스 보손', layer: 5,
    scaleM: '<1e-18', decade: 9, real: true, massEv: '1.252e11', charge: 0, spin: 0,
    rarity: 'EPIC', unlockDec: 15, discoverable: true,
    unlockConditionKo: 'L5 도감 10개 완료 + 모든 보손 카테고리 해금',
    unlockBonusKo: '모든 입자 질량 부여자 — 도감 완성도 풀에 흡수(별도 상수곱 금지, economy §7.2.5)',
    flavorKo: '2012년 LHC. 50년의 예측이 현실이 됐다. 표준모형은 완성됐다 — 혹은 그렇게 생각했다.',
  },
  {
    id: 'quark_gluon_plasma', name: '쿼크-글루온 플라즈마', nameKo: '쿼크-글루온 플라즈마', layer: 5,
    scaleM: '1e-15', decade: 9, real: true, massEv: null, charge: null, spin: null,
    rarity: 'EPIC', unlockDec: 16, discoverable: true,
    unlockConditionKo: '점근 자유 50회 + 6쿼크 모두 발견',
    unlockBonusKo: '점근 자유 지속 시간 대폭 증가 + 미지 영역 첫 입자 해금 조건 충족',
    flavorKo: '빅뱅 직후 10⁻⁶초의 우주. 쿼크가 자유로웠던 유일한 시간. 이제 그 아래로.',
  },
  // 추가 3종 — 쿼크층 17개 채움(codex L5는 표준모형 완성 = 12 fermion/boson + 1 QGP + 완성보너스
  //   + 1세대 렙톤 e/νₑ는 L2에 있으므로, 쿼크층은 6쿼크 + 3세대렙톤τ/ντ + 보손W/Z/H/g(γ는 L2)
  //   + QGP + 뮤온뉴트리노 = 14, 여기에 점입자 취급 e⁻/μ⁻ 재관측 2 + 완성 1 = 17).
  {
    id: 'electron_pointlike', name: 'e⁻ (점입자)', nameKo: '전자 (점입자로서)', layer: 5,
    scaleM: '<1e-18', decade: 9, real: true, massEv: '5.109e5', charge: -1, spin: 0.5,
    rarity: 'COMMON', unlockDec: 16.5, discoverable: true,
    unlockConditionKo: '쿼크 스케일에서 전자 재관측 (점입자 확인)',
    unlockBonusKo: '렙톤 점입자 카테고리 — D 트리클 소폭 증가',
    flavorKo: '이 스케일에서도 크기가 없다. 전자는 정말 점이다.',
  },
  {
    id: 'muon_pointlike', name: 'μ⁻ (점입자)', nameKo: '뮤온 (점입자로서)', layer: 5,
    scaleM: '<1e-18', decade: 9, real: true, massEv: '1.057e8', charge: -1, spin: 0.5,
    rarity: 'UNCOMMON', unlockDec: 17, discoverable: true,
    unlockConditionKo: '뮤온 기발견 + 쿼크 스케일 재관측',
    unlockBonusKo: '2세대 렙톤 점입자 — 점근 자유 보너스 소폭 증가',
    flavorKo: '전자와 똑같이 점이다. 다만 207배 무겁다. 질량의 기원은 어디인가.',
  },
  {
    id: 'gluon_octet', name: 'g (글루온 8중항)', nameKo: '글루온 8중항', layer: 5,
    scaleM: '0', decade: 9, real: true, massEv: '0', charge: 0, spin: 1,
    rarity: 'RARE', unlockDec: 18, discoverable: true,
    unlockConditionKo: '글루온 기발견 + 점근 자유 40회 (8색 조합 관측)',
    unlockBonusKo: '강력 매개 8종 완성 — 색전하 연구 시너지 증가',
    flavorKo: '글루온은 하나가 아니다. 8개의 색 조합. 강력의 진짜 얼굴.',
  },
  {
    id: 'l5_completion', name: 'L5 완성 — 표준모형 완성', nameKo: '표준모형 완성', layer: 5,
    scaleM: '0', decade: 9, real: true, massEv: null, charge: null, spin: null,
    rarity: 'LEGENDARY', unlockDec: 19, discoverable: false,
    unlockConditionKo: 'L5 도감 16/16 완성 (모든 표준모형 입자 발견)',
    unlockBonusKo: '미지 영역 해금 — 프리온층 진입 보너스 대폭 제공 + QF 트리클 상시 시작',
    flavorKo: '인류가 발견한 모든 입자를 기록했다. 표준모형의 끝. 그리고 새로운 시작.',
  },
];

/**
 * L6 프리온층 (미지, 서사 dec9~12). 7입자(완성보너스 1 포함). codex.md §7.
 * 발견: **위상 상태 기반**(systems §2-E) — P+/P-/P0는 응집/분산/공명 누적, 삼합체·진공·매듭은
 *   상태 전환·decade 진척. 상전이 후 dec=0이라 dec 게이트 대신 mechGate로 game.ts가 판정.
 * unlockDec=19(프리온 진입 = PT1 벽)는 표식만 — 실제 게이트는 mechGate.
 */
const PREON: Particle[] = [
  {
    id: 'preon_plus', name: 'P⁺ (양위상 프리온)', nameKo: '양위상 프리온', layer: 6,
    scaleM: '<1e-19', decade: 9, real: false, massEv: null, charge: 0.333, spin: 0.5,
    rarity: 'COMMON', unlockDec: 19, discoverable: true,
    mechGate: { kind: 'phase', state: 'coherent', seconds: 10 },
    unlockConditionKo: '프리온층 진입 + 위상 응집(Coherent) 상태 10회 유지',
    unlockBonusKo: '응집 상태 체인 배율 증가 (P+는 응집 상태의 산물)',
    flavorKo: '양의 위상을 가진 최초의 미지 입자. 쿼크가 이것으로 만들어졌다면?',
  },
  {
    id: 'preon_minus', name: 'P⁻ (음위상 프리온)', nameKo: '음위상 프리온', layer: 6,
    scaleM: '<1e-19', decade: 9, real: false, massEv: null, charge: -0.333, spin: 0.5,
    rarity: 'COMMON', unlockDec: 19, discoverable: true,
    mechGate: { kind: 'phase', state: 'dispersed', seconds: 10 },
    unlockConditionKo: '프리온층 진입 + 위상 분산(Dispersed) 상태 10회 유지',
    unlockBonusKo: '분산 상태 D 생산 증가 (P-는 분산 상태의 산물)',
    flavorKo: '음의 위상. 다운 쿼크의 재료. 보이지 않지만 항상 존재했다.',
  },
  {
    id: 'preon_zero', name: 'P⁰ (중립위상 프리온)', nameKo: '중립위상 프리온', layer: 6,
    scaleM: '<1e-20', decade: 10, real: false, massEv: null, charge: 0, spin: 0,
    rarity: 'UNCOMMON', unlockDec: 19, discoverable: true,
    mechGate: { kind: 'phase', state: 'resonant', seconds: 20 },
    unlockConditionKo: 'P+ · P- 발견 후 공명(Resonant) 상태 20회 유지',
    unlockBonusKo: '공명 상태 QF 트리클 증가 (P0는 공명 상태의 중재자)',
    flavorKo: '위상 없는 프리온. 다른 프리온들 사이의 매개자.',
  },
  {
    id: 'coherent_preon', name: '응집 프리온 (P⁺P⁻P⁰ 삼합체)', nameKo: '응집 프리온 삼합체', layer: 6,
    scaleM: '<1e-19', decade: 10, real: false, massEv: null, charge: 0, spin: 0.5,
    rarity: 'RARE', unlockDec: 19, discoverable: true,
    // 세 프리온 모두 발견(P+/P-/P0 임계 충족) 후 응집 추가 누적 — game.ts가 "셋 다 발견 + 응집 누적"으로 판정.
    mechGate: { kind: 'phase', state: 'coherent', seconds: 40 },
    unlockConditionKo: '세 프리온 모두 발견 후 위상 상태 전환 100회',
    unlockBonusKo: '위상 상태 전환 E 소모 감소 (삼합체 이해 = 전환 비용 감소)',
    flavorKo: '세 프리온이 완전히 겹칠 때, 전하와 스핀이 재탄생한다.',
  },
  {
    id: 'phase_vacuum', name: '위상 진공 (Phase Vacuum)', nameKo: '위상 진공', layer: 6,
    scaleM: '1e-21', decade: 12, real: false, massEv: '0', charge: 0, spin: 0,
    rarity: 'RARE', unlockDec: 19, discoverable: true,
    // 위상 진공은 프리온층을 더 압축해 다음 벽 근접 시(decade 진척) — 프리온층 내 dec 진척으로 판정.
    mechGate: { kind: 'decade', dec: 20.5 },
    unlockConditionKo: 'L6 도감 4개 완료 + 더 깊은 압축 (다음 벽 근접)',
    unlockBonusKo: '끈층 진입 시 진동 에너지 V 초기값 증가 (진공 에너지 저장)',
    flavorKo: '위상이 모두 사라진 자리. 하지만 진공은 비어있지 않다.',
  },
  {
    id: 'phase_knot', name: '위상 매듭 (Phase Knot)', nameKo: '위상 매듭', layer: 6,
    scaleM: '1e-21', decade: 12, real: false, massEv: null, charge: 0, spin: 1,
    rarity: 'EPIC', unlockDec: 19, discoverable: true,
    mechGate: { kind: 'phase', state: 'resonant', seconds: 60 },
    unlockConditionKo: '위상 고정 숙련 + L6 도감 5개 완료',
    unlockBonusKo: '위상 고정 E 비용 대폭 감소 (매듭 = 안정적 고정)',
    flavorKo: '위상이 꼬여 풀리지 않는다. 위상학적 보호 상태.',
  },
  {
    id: 'l6_completion', name: 'L6 완성 — 프리온 도감', nameKo: '위상 입자 도감 완성', layer: 6,
    scaleM: '0', decade: 12, real: false, massEv: null, charge: null, spin: null,
    rarity: 'LEGENDARY', unlockDec: 19, discoverable: false,
    mechGate: { kind: 'layerComplete' },
    unlockConditionKo: 'L6 도감 6/6 완성',
    unlockBonusKo: '끈층 진입 진동 에너지 V 최대 용량 증가 + 하모닉 첫 공명 즉시 발동',
    flavorKo: '위상의 모든 상태를 기록했다. 이제 모든 것은 진동이다.',
  },
];

/**
 * L7 끈층 (미지, 서사 dec12~15). 6입자(완성보너스 1 포함). codex.md §8.
 * 발견: **하모닉 공명 횟수 기반**(systems §2-F). 개방/폐쇄끈 = 공명 누적, 타키온·브레인·중력자 =
 *   더 많은 공명. 상전이 후 dec=0이라 mechGate로 game.ts가 판정. unlockDec=21.5(끈 진입=PT2 벽)는 표식.
 */
const STRING: Particle[] = [
  {
    id: 'open_string_mode1', name: '개방끈 n=1', nameKo: '개방끈 기본 진동', layer: 7,
    scaleM: '1e-33', decade: 12, real: false, massEv: '0', charge: 0, spin: 1,
    rarity: 'COMMON', unlockDec: 21.5, discoverable: true,
    mechGate: { kind: 'harmonic', resonances: 1 },
    unlockConditionKo: '끈층 진입 즉시 (첫 하모닉 공명 발생)',
    unlockBonusKo: '체인 T1 하모닉 공명 빈도 증가',
    flavorKo: '끈의 가장 낮은 진동. 이 모드에서 광자가 태어난다.',
  },
  {
    id: 'closed_string_mode1', name: '폐쇄끈 n=1', nameKo: '폐쇄끈 기본 진동', layer: 7,
    scaleM: '1e-33', decade: 12, real: false, massEv: '0', charge: 0, spin: 2,
    rarity: 'COMMON', unlockDec: 21.5, discoverable: true,
    mechGate: { kind: 'harmonic', resonances: 3 },
    unlockConditionKo: '하모닉 공명 3회',
    unlockBonusKo: 'QF 트리클 증가 (스핀 2 = 중력자 예고 = 영구 힘)',
    flavorKo: '스핀 2. 이 모드에서 중력자가 나온다. 끈이론이 중력을 품은 이유.',
  },
  {
    id: 'tachyon_string', name: '타키온 모드 (n=0 개방끈)', nameKo: '타키온 끈 모드', layer: 7,
    scaleM: '1e-33', decade: 13, real: false, massEv: '허수 질량', charge: 0, spin: 0,
    rarity: 'RARE', unlockDec: 21.5, discoverable: true,
    mechGate: { kind: 'harmonic', resonances: 8 },
    unlockConditionKo: '하모닉 조율 숙련 + 공명 8회',
    unlockBonusKo: '하모닉 간격 단축 (타키온의 불안정성 = 빠른 공명)',
    flavorKo: '허수 질량. 진공 불안정성의 신호. 실제 끈이론은 이를 제거하지만 — 여기선 활용한다.',
  },
  {
    id: 'd_brane', name: 'D-브레인 (D2)', nameKo: 'D2-브레인', layer: 7,
    scaleM: '1e-33', decade: 14, real: false, massEv: null, charge: 0, spin: 0,
    rarity: 'RARE', unlockDec: 21.5, discoverable: true,
    mechGate: { kind: 'harmonic', resonances: 16 },
    unlockConditionKo: '개방끈·폐쇄끈 모두 발견 + 하모닉 공명 16회',
    unlockBonusKo: '스핀 네트워크 노드 비용 소폭 감소 (브레인 = 네트워크 예고)',
    flavorKo: '개방끈이 끝점을 고정시키는 막. 우리 우주 자체가 이것 위에 있을지 모른다.',
  },
  {
    id: 'graviton_string', name: '중력자 끈 모드', nameKo: '중력자 (끈 모드)', layer: 7,
    scaleM: '1e-33', decade: 15, real: false, massEv: '0', charge: 0, spin: 2,
    rarity: 'EPIC', unlockDec: 21.5, discoverable: true,
    mechGate: { kind: 'harmonic', resonances: 24 },
    unlockConditionKo: 'L7 도감 4개 완료 + 하모닉 공명 24회',
    unlockBonusKo: '체인 전 티어 하모닉 공명 배율 소폭 증가 (중력 = 모든 것에 영향)',
    flavorKo: '아직 발견된 적 없는 입자. 하지만 끈이론은 이것이 존재해야 한다고 말한다.',
  },
  {
    id: 'l7_completion', name: 'L7 완성 — 끈 도감', nameKo: '진동 스펙트럼 완성', layer: 7,
    scaleM: '0', decade: 15, real: false, massEv: null, charge: null, spin: null,
    rarity: 'LEGENDARY', unlockDec: 21.5, discoverable: false,
    mechGate: { kind: 'layerComplete' },
    unlockConditionKo: 'L7 도감 5/5 완성',
    unlockBonusKo: '루프층 진입 시 스핀 네트워크 초기 노드 무료 제공',
    flavorKo: '모든 진동을 들었다. 이제 시공간 자체를 그릴 차례.',
  },
];

/**
 * 입자 도감(M1.6 현재 70입자). 알려진 물리 57(L1~L5) + 미지 13(프리온7 + 끈6).
 * 후속: 루프5 + 거품5 + 정보4 + 플랑크3 = 17 추가 → 최종 87.
 */
export const PARTICLES: readonly Particle[] = [
  ...MOLECULE,
  ...ATOM,
  ...NUCLEUS,
  ...HADRON,
  ...QUARK,
  ...PREON,
  ...STRING,
];

/** id → 입자. */
export function particleById(id: string): Particle | undefined {
  return PARTICLES.find((p) => p.id === id);
}

/** 층 index(1..11)의 입자 목록(unlockDec 오름차순). */
export function particlesByLayer(layerIndex: number): Particle[] {
  return PARTICLES.filter((p) => p.layer === layerIndex).sort((a, b) => a.unlockDec - b.unlockDec);
}

/** 층 id의 입자 목록. */
export function particlesByLayerId(layerId: string): Particle[] {
  const def = layerById(layerId);
  return def ? particlesByLayer(def.index) : [];
}
