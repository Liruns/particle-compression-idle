/**
 * audio/voices — 이벤트 → 소리 서술자(VoiceSpec). **순수 함수 · WebAudio 비의존**(테스트 가능).
 *
 *  audio-design.md 정신: "침묵 기반 · 층 색온도 ↔ 음역 동기 · AI 슬롭(과주스) 금지."
 *  절차적 합성(에셋 0)이라 여기선 오실레이터 파라미터만 계산하고, 실제 재생은 engine.ts가 한다.
 *
 *  설계 원칙:
 *   - 능동(플레이어가 만진 것) = 들린다. 자동/방치 이벤트(phase_cycled·resonance_auto·saved)는 소리 없음.
 *   - 층이 깊어질수록(작아질수록) 기음이 올라간다 = "작아짐" 테마 + 색온도 아크(따뜻→차가움)의 청각 대응.
 *   - 짧고 부드럽게. 클릭 하나에 화음 폭발 금지(§audio 금지목록).
 */

/** 한 오실레이터 보이스(engine이 envelope를 씌워 재생). freq=Hz, dur=초, gain=피크(0..1, master 이전). */
export interface VoiceSpec {
  wave: OscillatorType;
  /** 시작 주파수(Hz). */
  freq: number;
  /** 지속(초) — attack+decay 합. */
  dur: number;
  /** 피크 게인(0..1). master·volume가 다시 곱해진다. */
  gain: number;
  /** 어택(초). 기본 0.005(딸깍) — 패드류는 길게. */
  attack?: number;
  /** 디튠(cents) — 코러스감/불안정. */
  detune?: number;
  /** 글라이드 목표 주파수(Hz). 있으면 freq→glideTo로 exponential ramp. */
  glideTo?: number;
  /** 재생 지연(초) — 아르페지오/화음 계단용. */
  delay?: number;
}

/** 5음계(마이너 펜타토닉) 반음 오프셋. 무작위 음정 대신 항상 협화 — "AI 슬롭" 회피. */
const PENTATONIC = [0, 3, 5, 7, 10];
/** 기음 루트(G3 ≈ 196Hz). 층이 깊을수록 위로 쌓인다. */
const ROOT_HZ = 196;

/**
 * 층 인덱스(1=분자 … 11=플랑크) → 기음(Hz). 층마다 펜타토닉 한 계단 상승.
 *  깊이(작아짐) = 음고 상승 = 테마 청각 매핑. 범위 밖 인덱스는 클램프.
 */
export function layerBaseFreq(layerIndex: number): number {
  const step = Math.max(0, Math.min(10, Math.round(layerIndex) - 1));
  const octave = Math.floor(step / PENTATONIC.length);
  const degree = step % PENTATONIC.length;
  const semitone = octave * 12 + PENTATONIC[degree];
  return ROOT_HZ * Math.pow(2, semitone / 12);
}

/** 반음 위 주파수(협화 화음 구성용). */
function semi(freq: number, semitones: number): number {
  return freq * Math.pow(2, semitones / 12);
}

/** 이벤트 → 보이스 계산에 필요한 컨텍스트(표시 스냅샷과 무관 — 최소 입력). */
export interface VoiceContext {
  /** 현재 층 인덱스(음역 결정). */
  layerIndex: number;
}

/**
 * 도메인 이벤트 → 재생할 보이스 목록(빈 배열=무음). 이벤트 페이로드의 관련 필드만 받는다.
 *  ★순수: 같은 입력이면 같은 보이스. 난수·시간·전역상태 없음(엔진이 throttle/master를 담당).
 */
export function voiceForEvent(
  name: string,
  payload: Record<string, unknown>,
  ctx: VoiceContext,
): VoiceSpec[] {
  const base = layerBaseFreq(ctx.layerIndex);
  switch (name) {
    case 'manual_compress':
      // 물질 응축 — 부드러운 저역 pluck(삼각파). 드래그 연타는 엔진이 throttle.
      return [{ wave: 'triangle', freq: base / 2, dur: 0.13, gain: 0.16, attack: 0.004 }];

    case 'chain_purchased': {
      // 결속 — 따뜻한 2음(루트+5도). 수량이 많을수록 아주 살짝 밝게(상한).
      const count = typeof payload.count === 'number' ? payload.count : 1;
      const bright = Math.min(0.06, count * 0.004);
      return [
        { wave: 'triangle', freq: base, dur: 0.16, gain: 0.14 + bright, attack: 0.004 },
        { wave: 'sine', freq: semi(base, 7), dur: 0.2, gain: 0.1 + bright, attack: 0.004, delay: 0.045 },
      ];
    }

    case 'resonance_click': {
      // 오비탈 공명 — 성공=맑은 벨(옥타브 위 정현), 실패=둔탁한 저역(놓침, 페널티 아님).
      const success = payload.success === true;
      if (success) {
        return [
          { wave: 'sine', freq: semi(base, 12), dur: 0.32, gain: 0.2, attack: 0.003 },
          { wave: 'sine', freq: semi(base, 19), dur: 0.24, gain: 0.09, attack: 0.003, delay: 0.02 },
        ];
      }
      return [{ wave: 'sine', freq: base / 2, dur: 0.12, gain: 0.07, attack: 0.01 }];
    }

    case 'resonance_slot_open':
      // 슬롯 열림 — "기회" 신호. 아주 옅은 고역 반짝.
      return [{ wave: 'sine', freq: semi(base, 24), dur: 0.16, gain: 0.05, attack: 0.008 }];

    case 'phase_pinned':
      // 위상 고정 — 상태로 스며드는 패드 스웰(느린 어택).
      return [{ wave: 'sine', freq: semi(base, 4), dur: 0.5, gain: 0.13, attack: 0.09 }];

    case 'phase_unpinned':
      return [{ wave: 'sine', freq: semi(base, 4), dur: 0.22, gain: 0.06, attack: 0.02 }];

    case 'phase_pin_failed':
    case 'buy_failed':
      // 자원 부족 — 부드러운 둔탁음(불쾌하지 않게).
      return [{ wave: 'triangle', freq: base / 3, dur: 0.14, gain: 0.08, attack: 0.012 }];

    case 'harmonic_resonance': {
      // 진동 하모닉스 — 공명한 티어만큼 위로 올라가는 벨(끈층 폭발).
      const tier = typeof payload.tier === 'number' ? payload.tier : 1;
      return [{ wave: 'sine', freq: semi(base, 12 + tier), dur: 0.4, gain: 0.14, attack: 0.004 }];
    }

    case 'research_purchased':
      // 연구 해금 — 확정적 3음 상승 아르페지오(작지만 또렷).
      return [
        { wave: 'triangle', freq: base, dur: 0.14, gain: 0.11, attack: 0.004 },
        { wave: 'triangle', freq: semi(base, 5), dur: 0.14, gain: 0.11, attack: 0.004, delay: 0.06 },
        { wave: 'sine', freq: semi(base, 12), dur: 0.22, gain: 0.1, attack: 0.004, delay: 0.12 },
      ];

    case 'codexDiscover': {
      // 입자 발견 — 작은 종. 전설(LEGENDARY)은 옥타브 화음으로 더 풍성.
      const legendary = payload.legendary === true;
      if (legendary) {
        return [
          { wave: 'sine', freq: semi(base, 12), dur: 0.5, gain: 0.16, attack: 0.004 },
          { wave: 'sine', freq: semi(base, 16), dur: 0.44, gain: 0.1, attack: 0.004, delay: 0.05 },
          { wave: 'sine', freq: semi(base, 19), dur: 0.4, gain: 0.09, attack: 0.004, delay: 0.1 },
        ];
      }
      return [{ wave: 'sine', freq: semi(base, 15), dur: 0.22, gain: 0.09, attack: 0.004 }];
    }

    case 'layerEnter':
      // 새 세계 진입 — 낮은 스웰 + 옥타브(하강해 이어짐). 층색 음역이 이미 base에 반영.
      return [
        { wave: 'sine', freq: base / 2, dur: 0.9, gain: 0.13, attack: 0.18 },
        { wave: 'sine', freq: base, dur: 0.8, gain: 0.08, attack: 0.2, detune: 4 },
      ];

    case 'prestige_ready':
      // 상전이 가능 — 문턱이 열렸다는 조용한 고역 신호(재촉 아님).
      return [{ wave: 'sine', freq: semi(base, 19), dur: 0.45, gain: 0.08, attack: 0.05 }];

    case 'prestige': {
      // 상전이 — 머니샷. 넓게 퍼지는 상승 화음(느낌표 1회 정신, 절제된 폭발).
      const isFirst = payload.count === 1;
      const g = isFirst ? 0.22 : 0.18;
      return [
        { wave: 'sine', freq: base / 2, dur: 1.4, gain: g, attack: 0.02, glideTo: base },
        { wave: 'sine', freq: base, dur: 1.3, gain: g * 0.7, attack: 0.03, glideTo: semi(base, 7), delay: 0.04 },
        { wave: 'sine', freq: semi(base, 7), dur: 1.2, gain: g * 0.6, attack: 0.04, glideTo: semi(base, 12), delay: 0.09 },
        { wave: 'sine', freq: semi(base, 12), dur: 1.1, gain: g * 0.5, attack: 0.05, delay: 0.14 },
      ];
    }

    case 'offlineApplied':
      // 오프라인 복귀 — 낮고 따뜻한 귀환음(자리비움을 채워 넣음).
      return [
        { wave: 'sine', freq: base / 2, dur: 0.7, gain: 0.12, attack: 0.06 },
        { wave: 'sine', freq: semi(base / 2, 7), dur: 0.6, gain: 0.07, attack: 0.08, delay: 0.05 },
      ];

    case 'achievement_earned':
      // 관측 목표 달성 — 또렷한 확인 2음(4도+옥타브 상승). 발견의 만족감, 절제.
      return [
        { wave: 'sine', freq: semi(base, 7), dur: 0.28, gain: 0.13, attack: 0.004 },
        { wave: 'sine', freq: semi(base, 12), dur: 0.34, gain: 0.12, attack: 0.004, delay: 0.07 },
      ];

    default:
      // saved(오토세이브 주기 소음)·phase_cycled·resonance_auto 등 자동/방치 이벤트 = 무음.
      return [];
  }
}
