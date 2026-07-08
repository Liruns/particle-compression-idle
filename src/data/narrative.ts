/**
 * data/narrative — 층 진입 비트 + 시그니처 카피 (데이터 주도). (narrative.md §4-1·§5)
 *
 * "냉정+경이, 느낌표는 플랑크 단 한 번을 위해 아껴둔다." 보이스 규칙(narrative §2-B).
 * M1.3 범위: 알려진 물리 5층 진입 비트(분자→쿼크). 미지 서브층 비트·상전이 메시지는 M1.5+.
 *
 * 출처(narrative.md §4-1 원문, 임의 변경 금지 — 보이스는 narrative-designer 소관):
 *   각 층 진입 시 표시되는 짧은 내러티브 모먼트(상전이 아님 — 알려진 물리는 무상전이).
 */

/** 층 진입 비트: 층 index → 짧은 텍스트(2~3줄). 진입 순간 1회 표시. */
export interface LayerEntryBeat {
  /** 진입하는 층 index(1..5). */
  layerIndex: number;
  /** 비트 라인들(narrative §4-1, 1~3줄). */
  lines: string[];
}

/**
 * 알려진 물리 5층 진입 비트. (narrative.md §4-1)
 *  L1(분자)은 게임 시작점이라 별도 "진입 비트" 없음 — 첫 화면 카피(§5-D)가 담당.
 *  L2~L5는 §4-1 비트 1~4 그대로.
 */
export const LAYER_ENTRY_BEATS: readonly LayerEntryBeat[] = [
  // L1 분자층: 시작점. 진입 비트 대신 첫 화면 카피(아래 FIRST_SCREEN).
  {
    layerIndex: 2, // 분자 → 원자 (dec1)
    lines: [
      '원자 스케일 진입. 1×10⁻¹⁰ m.',
      '전자 껍질이 구분된다. 오비탈이 보인다.',
      '원자핵이 중심에 있다. 아주 작고, 거의 비어있다.',
    ],
  },
  {
    layerIndex: 3, // 원자 → 핵 (dec5)
    lines: [
      '핵 스케일 진입. 1×10⁻¹⁴ m.',
      '이 크기에서 강한 핵력이 작동하기 시작한다. 핵자들이 묶여 있다.',
      '압축이 더 어려워진다. 예상된 일이다.',
    ],
  },
  {
    layerIndex: 4, // 핵 → 핵자 (dec6)
    lines: [
      '핵자 스케일 진입. 1×10⁻¹⁵ m.',
      '색전하가 처음으로 측정된다. 적, 청, 녹.',
      '쿼크는 혼자 존재하지 않는다.',
    ],
  },
  {
    layerIndex: 5, // 핵자 → 쿼크 (dec9) — 알려진 물리의 경계
    lines: [
      '쿼크 스케일 진입. 1×10⁻¹⁸ m.',
      '표준 모델이 예측하는 마지막 구조물이 여기다.',
      '이 이하는 아직 아무것도 측정된 적 없다.',
    ],
  },
] as const;

/** 층 index → 진입 비트(없으면 undefined — L1은 비트 없음). */
export function layerEntryBeat(layerIndex: number): LayerEntryBeat | undefined {
  return LAYER_ENTRY_BEATS.find((b) => b.layerIndex === layerIndex);
}

/**
 * 상전이 비트(미지 서브층 진입, narrative §4·§5-B). 상전이 1~6에만 적용 — 알려진 물리는 무상전이.
 *  prestigeIndex → 발화 라인. game.ts가 상전이 실행 후 발행(층 진입 비트와 분리, §4-0 트리거 분리).
 *  M1.5는 PT1(쿼크→프리온, 비트 5 = 알려진 물리 종결 + 첫 상전이의 무게)만 사용.
 */
export interface PrestigeBeat {
  /** 상전이 prestigeIndex(1=프리온 … 6=플랑크). */
  prestigeIndex: number;
  /** 진입 후 발화 라인(narrative §4-2 비트, 1~3줄). PT1만 2줄 허용(첫 미지 진입, ui-flow §5-B). */
  lines: string[];
}

/**
 * 상전이 비트(narrative §4-2 비트 5·6·…). M1.5는 PT1(비트 5)만 실데이터, 나머지는 자리(M1.6+ 확장).
 *  비트 5(쿼크→프리온)는 유일하게 "알려진 물리 종결 + 첫 상전이 무게" 동시 — 연구소장 자신감 한 단계
 *  내려감(narrative 설계 노트). 보이스 규칙: 느낌표 없음(플랑크 단 한 번 위해 아껴둠, §2-B).
 */
export const PRESTIGE_BEATS: readonly PrestigeBeat[] = [
  {
    prestigeIndex: 1, // 쿼크층 → 프리온층 (dec19, 첫 상전이 = 미지 진입의 문턱)
    lines: [
      '측정 한계를 넘었다. 표준 모델에 없는 신호가 감지된다.',
      '프리온 — 가설로만 존재하던 이름. 로그에 기록한다.',
    ],
  },
  {
    prestigeIndex: 2, // 프리온층 → 끈층 (~dec21.5, 비트 6 — narrative §4-2)
    lines: [
      '프리온 구조 이하. 서사 스케일 1×10⁻²¹ m.',
      '입자가 아니다. 진동하는 무언가.',
      '끈이론이 이것을 예측했다. 끈이론이 맞을 수도 있다.',
    ],
  },
  {
    prestigeIndex: 3, // 끈층 → 루프층 (~dec23, narrative §4-2 비트 7). 신중해지는 목소리.
    lines: [
      '끈 이하. 서사 스케일 1×10⁻²⁴ m.',
      '공간이 연속적이지 않을 수 있다.',
      '스핀 네트워크 — 루프 양자중력이 말하던 시공간의 뼈대. 측정값이 일치하기 시작했다.',
    ],
  },
  {
    prestigeIndex: 4, // 루프층 → 거품층 (~dec24.5, 비트 8). 관측 행위가 시스템에 영향.
    lines: [
      '서사 스케일 1×10⁻²⁷ m.',
      '진공이 비어있지 않다. 이 크기에서 요동이 측정된다.',
      '불확정성 원리는 이 구간에서 배경이 아니라 현상이다.',
    ],
  },
  {
    prestigeIndex: 5, // 거품층 → 정보층 (~dec25.5, 비트 9). 도감을 채운 이에게 특히 울림.
    lines: [
      '서사 스케일 1×10⁻³⁰ m.',
      '공간이 정보를 저장하는 방식이 바뀐다.',
      '지금까지의 모든 관측이 이 층에서 반향한다. 과거가 지금 배율에 기여한다.',
    ],
  },
  {
    prestigeIndex: 6, // 정보층 → 플랑크층 (dec26, 비트 10). 말이 줄어든다. 마지막 상전이 경계.
    lines: [
      '서사 스케일 1×10⁻³³ m. 플랑크 길이까지 두 자릿수.',
      '시공간 자체가 이산적으로 변하기 시작한다.',
      '마지막 압축을 준비한다.',
    ],
  },
] as const;

/** prestigeIndex → 상전이 비트(없으면 undefined). */
export function prestigeBeat(prestigeIndex: number): PrestigeBeat | undefined {
  return PRESTIGE_BEATS.find((b) => b.prestigeIndex === prestigeIndex);
}

/**
 * 상전이 실행 순간 로그(narrative §5-B "상전이 실행 순간"). 상태 로그 1줄로 발화.
 *  "압축 초기화. 양자 거품 +{N} 적립. {다음 층} 진입." — N·층 이름은 game.ts가 주입.
 */
export function prestigeExecLog(qfGainText: string, nextLayerKo: string): string {
  return `압축 초기화. 양자 거품 +${qfGainText} 적립. ${nextLayerKo} 진입.`;
}

/** 첫 화면 카피(narrative §5-D 게임 시작). */
export const FIRST_SCREEN_LINES: readonly string[] = ['물질이 있다.', '압축하라.'] as const;

/** 재하강 화면 고정 문구(narrative §4-4 — M1.5+ 사용, 현재는 footer whisper). */
export const WHISPER = '더 작은 것이 있다.';
