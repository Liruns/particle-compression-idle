# 시스템 흐름 및 예외 조건 (system-flows v0.1)

- 작성: systems-designer
- 기준 문서: `systems.md` v1.1 / `economy.md` v0.3 §1·§3·§7 / `tech-architecture.md` v0.1 §1·§3·§4·§7
- 용도: **game-programmer 구현 입력 스펙** — 단계 시퀀스(happy path) + 예외·엣지 조건 + 상태 머신 + 결정성 정합
- 수치·배율은 economy/systems 확정값을 그대로 인용. 이 문서에서 재설계하지 않음.

---

## 문서 구조

1. [생산 Tick — 고정 timestep 시퀀스](#1-생산-tick)
2. [압축기 구매 — 닫힌형 대량구매](#2-압축기-구매)
3. [층 진입 vs 상전이 — 분리 흐름](#3-층-진입-vs-상전이)
4. [첫 상전이 (PT1 · QF 획득)](#4-첫-상전이-pt1--qf-획득)
5. [빅 크런치 → 재하강](#5-빅-크런치--재하강)
6. [세이브 / 로드](#6-세이브--로드)
7. [오프라인 복귀 (일괄 / 미니시뮬)](#7-오프라인-복귀)
8. [도감 발견](#8-도감-발견)
9. [연구 노드 구매 · 효과 적용](#9-연구-노드-구매--효과-적용)
10. [★ 예외·엣지 조건 총람](#10-예외엣지-조건-총람)
11. [상태 머신 — 핵심 전이 다이어그램](#11-상태-머신)
12. [결정성·Economy 시뮬 정합](#12-결정성)
13. [R1~R9 리스크 매핑 표](#13-r1r9-리스크-매핑)

---

## 1. 생산 Tick

### 1.1 Happy Path — 고정 timestep 누산기

```
[매 requestAnimationFrame]
  실경과시간 += frame_delta
  while 실경과시간 >= DT:
      실경과시간 -= DT
      tick(DT)              ← 결정적 로직 단위

[tick(dt) 내부 순서]
  1. 자원 생산
     g8 → g7 → … → g1 순으로 역순 패스
       g_k += g_{k+1} * production_mult * dt      (k=7..1)
     C  += g1 * production_mult * dt

  2. lifetime_C 누적
     lifetime_C += delta_C   (이번 tick의 C 증분)

  3. 파생값 갱신 (변경된 입력이 있을 때만 캐시 무효화)
     dec  = alpha * log10(C + 1)          (alpha=0.65)
     r    = r0 * 10^(-dec)                (r0=1e-9)
     production_mult = QF 부스트 * holographic_mult * research_mult

  4. 층 진입 체크
     if dec >= layer_threshold[next_layer]: 층 진입 흐름(§3)

  5. 상전이 가능 체크 (미지 서브층 한정)
     if next_layer in UNKNOWN_LAYERS and dec >= wall[next_layer]:
         phase_transition_available = True   ← UI 탭 점등, 이 시점엔 리셋 안 함

  6. 메커니즘 tick
     해당 층 메커니즘 모듈의 tick(dt) 호출
       — 핵력 게이지 충전 / 위상 순환 / 하모닉 V 누적 / 요동 타이머 등

  7. D 트리클 생산
     D_current += compression_depth_trickle * dt

  8. 이벤트 버스 발행
     필요 시 "tick_complete" 등 발행 (렌더·사운드 구독)
```

**DT 선택 원칙**: economy 시뮬 가정 dt=1~2s와 정합되는 값으로 확정(tech-arch §4.1). 렌더(rAF)와 완전 분리.

### 1.2 catch-up 상한

백그라운드 복귀나 장시간 탭 전환 후 누산기에 쌓인 시간이 `CATCHUP_MAX`(튜닝 파라미터)를 초과하면:

```
while 실경과시간 >= DT:
    if catchup_ticks > CATCHUP_MAX_TICKS:
        오프라인 계산 경로(§7)로 나머지 분량 일괄 처리
        실경과시간 = 0
        break
    tick(DT)
    catchup_ticks++
```

### 1.3 예외·엣지

| 조건 | 처리 |
|---|---|
| `frame_delta`가 매우 큼 (브라우저 스로틀 해제 순간) | `CATCHUP_MAX_TICKS` 상한으로 폭주 방지 → 초과분을 오프라인 일괄 경로로 |
| `C`가 Decimal 범위를 넘을 위험 | break_eternity 기반이라 원칙상 없음. 그러나 직렬화 전 `.isFinite()` 방어 체크 |
| `production_mult` 계산 중 Decimal NaN | validate 단계에서 최솟값 1.0 클램프 |
| DT=0 또는 음수 | 입력 방어: DT ≤ 0이면 tick 스킵 |
| 층 진입 체크가 한 틱에 두 층 이상 통과 | while 루프로 연속 체크, 단 **두 번째 층은 다음 tick**에서 처리 (한 틱 1 층 제한) |

---

## 2. 압축기 구매

### 2.1 Happy Path — 닫힌형 대량구매

단일 구매와 "최대 구매" 모두 동일 경로를 쓴다. `while-bank` 루프 금지(economy §0, tech-arch §6.2).

```
[구매 요청: buy(tier_k, target_count)]
  n_current = chain.bought[k]

  1. 구매 가능 수량 계산 (닫힌형 등비급수)
     max_buyable = floor( log(1 + E * (growth_k - 1) / cost_k(n_current)) / log(growth_k) )
     n_buy = min(target_count, max_buyable)

     if n_buy == 0: → "E 부족" UI 피드백, 종료

  2. 총 비용 계산 (등비급수 합)
     total_cost = cost_k(n_current) * (growth_k^n_buy - 1) / (growth_k - 1)

  3. 원자적 적용
     E -= total_cost
     chain.bought[k] += n_buy

  4. 파생 캐시 무효화
     production_cache[k] = DIRTY     ← 다음 tick에서 재계산

  5. 이벤트 발행
     emit("chain_purchased", { tier: k, count: n_buy })
```

**대량구매 버튼(×10, ×100, Max)**:
- ×10 / ×100: `target_count`를 10 / 100으로 고정
- Max: `target_count = max_buyable` (전액 투입)

### 2.2 비용 수식 참조

```
cost_k(n) = base_k * growth_k^n
base_k    = 10^(1 + 1.3*k)                  (economy §2.1)
growth_k  = 2.2 - (0.4/7)*(k-1)             T1=2.2 … T8=1.8
```

### 2.3 예외·엣지

| 조건 | 처리 |
|---|---|
| `growth_k == 1.0` (이론상 불가, 방어) | 닫힌형 공식 분모 0 → 선형 공식 `n*cost_k(n_current)` 대체 |
| `E`가 Decimal이고 `total_cost`가 Decimal | 반드시 `.gte()`, `.sub()` 사용, native `>=` / `-` 금지 |
| `n_buy` 계산에 부동소수 오차로 실제 비용 > E | 단계 3에서 E 잔액 재검증: `if E.lt(total_cost)` 이면 `n_buy--` 후 재계산 |
| Tier-1만 계속 구매 (타이밍 미스) | 게임 로직에 강제 없음, 단 §4.1 최적티어 자연 이동 구조가 유도 |
| 구매 중 상전이 발생 (타이밍 경쟁) | 구매 먼저 완료 → tick에서 상전이 체크 순서 유지 (구매는 동기, 상전이 판정은 tick) |

---

## 3. 층 진입 vs 상전이

### 3.1 핵심 분리 원칙

```
알려진 물리 5층(dec0~19): 층 진입 = 스케일+도감+내러티브. 리셋 없음, QF 없음.
미지 서브층 6개(dec19~26): 층 진입과 상전이가 1:1. 상전이는 플레이어 선택.
```

### 3.2 알려진 물리 층 진입 흐름

```
[tick 내 층 진입 체크]
if dec >= KNOWN_LAYER_THRESHOLDS[next_layer]:
    // 자동 진입 — 플레이어 확인 불필요
    1. current_layer = next_layer
    2. next_layer = current_layer + 1
    3. emit("layer_entered", { layer: current_layer })
       → Codex 모듈: 해당 층 입자 발견 체크
       → Narrative 모듈: 층 진입 비트 트리거
       → Research 모듈: 위상 심화 Branch 노드 1개 자동 해금
    4. 메커니즘 모듈 로드 (해당 층 메커니즘이 없으면 기존 유지)
    // 리셋 없음, QF 없음, 상전이 UI 없음
```

### 3.3 미지 서브층 — 상전이 가능 상태 진입

```
[tick 내 상전이 가능 체크]
if current_layer in UNKNOWN_LAYERS:
    wall_dec = WALLS[current_layer_index]   // [19, 21.5, 23, 24.5, 25.5, 26]
    if dec >= wall_dec and not phase_transition_available:
        phase_transition_available = True
        emit("phase_transition_ready", {
            layer: current_layer,
            preview_QF: compute_QF_gain(lifetime_C)
        })
        // UI: 상전이 탭 점등, QF 예정량 표시
        // 현재 런 진행 계속 — 자동 리셋 없음

// 플레이어 선택지:
// A. 지금 상전이 → §4 흐름
// B. 계속 압축 → dec 더 올려 더 큰 QF
//    (phase_transition_available=True 유지, 압축 계속)
```

### 3.4 쿼크→프리온 (첫 상전이 특수 케이스)

이 전환만 "알려진 물리 꼬리 종료 + 미지 진입 + 첫 상전이" 세 이벤트가 동시 결합한다:

```
dec19 도달 시:
    1. 쿼크 꼬리 종료 내러티브 비트 (층 진입 이벤트)
    2. 첫 미지 서브층(프리온) 진입 알림
    3. phase_transition_available = True
    4. 첫 상전이 강조 연출 트리거 (UX)
    // §4 흐름으로 이어짐
```

### 3.5 예외·엣지

| 조건 | 처리 |
|---|---|
| `dec` 정밀도 오차로 임계값 스킵 | 임계값 비교는 `>=` (strictly above), 스킵 방지용 매 tick 체크 |
| 복수 층 임계값 한 틱 초과 | 알려진 층: while 루프로 연속 처리 (단, 한 틱 1층 제한 권장). 미지 서브층: 첫 번째 벽에서 멈추고 상전이 대기 |
| 오프라인 중 여러 층 통과 | 오프라인 일괄 계산은 층 진입 이벤트를 일괄 발행(도감 발견·연구 해금 포함), 단 상전이는 오프라인 중 자동 실행 안 함 — 복귀 시 UI로 확인 |
| `WALLS` 인덱스 범위 초과 | 보호: `current_layer_index >= WALLS.length` 이면 빅 크런치 체크로 분기 |

---

## 4. 첫 상전이 (PT1 · QF 획득)

### 4.1 Happy Path

```
[플레이어: "상전이" 버튼 클릭]

  전제: phase_transition_available == True

  1. QF 계산 (원자적으로 — 크래시 방지용 저장 직전)
     QF_new_total = floor( K * (lifetime_C / D_norm)^0.5 )
                     // K=1 (PT1~PT6), D_norm=1e26 (economy §1.1)
                     // PT7(빅 크런치)는 K=1.05 (베켄슈타인, economy §7.4)
     QF_gain = QF_new_total - QF_claimed

  2. 원자적 저장 (크래시 방지)
     save_state({
       QF_pending_gain: QF_gain,
       prestige_in_progress: True,
       prestige_type: "phase_transition",
       N_prestige: current_N_prestige + 1
     })
     // 이 지점에서 크래시 → 로드 시 §6.3 미완료 상전이 복구

  3. 리셋 적용 (리셋 매트릭스, systems §5-2)
     E = Decimal(0)
     C = Decimal(0)
     chain.bought = [0, 0, 0, 0, 0, 0, 0, 0]
     D_current 처리:
       if run_index == 1: D_current = 0   // 첫 런은 보존율 없음
       else: D_current *= D_preservation_curve[run_index]
     // QF·도감·연구·D_lifetime = 보존

  4. QF 확정 적용
     QF_claimed = QF_new_total
     production_mult 캐시 무효화 (QF 변경 → 재계산 필요)

  5. 새 층(프리온) 진입
     current_layer = PREON_LAYER
     next_layer    = STRING_LAYER
     phase_transition_available = False
     N_prestige += 1

  6. 메커니즘 모듈 교체
     이전 층 메커니즘 모듈 언로드 (이벤트 구독 해제)
     프리온층 메커니즘(위상 겹침) 모듈 로드

  7. prestige_in_progress = False 저장 (완료 확정)

  8. 이벤트 발행
     emit("phase_transition_complete", { N: N_prestige, QF_gain, layer: PREON_LAYER })
     → Narrative: 상전이 메시지 7개 중 PT1 발화
     → Codex: 프리온 입자 발견 체크 트리거
     → UI: 상전이 탭 소등, 새 층 강조
     → Audio: 상전이 SFX

  9. PT1 특별 처리 (첫 상전이)
     첫 상전이 강조 연출 (UX)
     Research Branch C("자동화 확장") 해금 (systems §3-3: "상전이 1회 완료" 조건)
```

### 4.2 production_mult 갱신

```
QF 변경 후 매 tick production_mult 재계산:
  qf_boost = 1 + 0.25 * log10(1 + QF_claimed)        (economy §1.1)
  holo_mult = compute_holographic_mult()               (§8.3에서 상세)
  research_mult = 1.0                                  (systems C안, economy §7.2.1)
  production_mult = qf_boost * holo_mult * research_mult
```

### 4.3 예외·엣지

| 조건 | 처리 |
|---|---|
| 상전이 도중 크래시 (단계 2~7 사이) | 로드 시 `prestige_in_progress == True` → §6.3 복구 루틴: QF_pending_gain 재적용, 리셋 완료 후 정상화 |
| `QF_gain == 0` (C 너무 작음) | 상전이 자체는 허용하지만 UI에 "QF 0" 경고 표시. 강제 차단 안 함 (플레이어 선택 존중) |
| `lifetime_C`가 0 (이론상 불가) | `QF_new_total = 0`, `QF_gain = 0`. 예외 아님 |
| D_preservation_curve 인덱스 초과 | `run_index >= 7` 이상 → `curve[7] = 0.35` 하한 적용 |
| 연속 빠른 클릭 (이중 상전이 방지) | 상전이 시작 즉시 `phase_transition_available = False` + 버튼 비활성 (단계 2 이전) |

---

## 5. 빅 크런치 → 재하강

### 5.1 Happy Path

```
[빅 크런치 트리거 조건]
  current_layer == PLANCK_LAYER
  r <= PLANCK_LENGTH   (1.616e-35 m)
  → phase_transition_available = True (특수 플래그: is_big_crunch = True)

[플레이어: "빅 크런치" 확인]

  1. 집중 서브층 선택 UI (run_index >= 2)
     if run_index == 1:
         current_run_focus = None  // 첫 런은 전체 발견
     else:
         show_focus_selection(UNKNOWN_LAYERS, focus_history)
         // 플레이어가 선택해야 진행 (차단 UI)
         current_run_focus = player_choice
         focus_history.append(current_run_focus)

  2. QF 계산 (K=1.05 베켄슈타인, economy §7.4)
     QF_new_total = floor( 1.05 * (lifetime_C / 1e26)^0.5 )
     QF_gain = QF_new_total - QF_claimed

  3. 도감: 플랑크온 해금
     emit("particle_discovered", { id: "planckton", rarity: "LEGENDARY" })

  4. 원자적 저장 (크래시 방지)
     save_state({
       QF_pending_gain: QF_gain,
       prestige_in_progress: True,
       prestige_type: "big_crunch",
       run_index: run_index + 1,
       current_run_focus: current_run_focus
     })

  5. 리셋 적용 (§4.1 단계 3과 동일 + D 보존율 회차 곡선)
     E = C = chain.bought[:] = 0
     D_current *= D_preservation_curve[run_index + 1]  // 회차 곡선 적용
     D_lifetime = D_lifetime  // 100% 보존 불변
     // QF_claimed 아직 갱신 안 함 (단계 6에서)

  6. QF 확정 + 카운터 갱신
     QF_claimed = QF_new_total
     run_index += 1
     N_prestige += 1   // PT7 포함 상전이 횟수

  7. dec0 재시작 — 분자층부터
     current_layer = MOLECULE_LAYER
     next_layer    = ATOM_LAYER
     층별 메커니즘 전체 언로드 (이벤트 구독 해제)
     분자층 메커니즘 로드

  8. prestige_in_progress = False 저장 (완료 확정)

  9. 이벤트 발행
     emit("big_crunch_complete", { run_index, QF_gain, focus: current_run_focus })
     → Narrative: "재압축 / 이전 관측 유지 / 더 작은 것이 있다" 프레이밍 (엔딩 언어 금지)
     → UI: 재하강 시작 연출

  10. 재하강 후 온보딩 패스트트랙
      QF 부스트(production_mult)가 높으므로 dec0~19가 회차 1보다 훨씬 빠름
      단, 알려진 층 진입 이벤트(도감·내러티브)는 여전히 발화
```

### 5.2 집중 서브층 심화 콘텐츠 해금

```
[미지 서브층 진입 시 — 재하강 2회차+]
on_enter_sublayer(layer):
    if layer == current_run_focus:
        unlock_deep_content(layer, run_index)
        // systems §2-K: 심화 입자 2~3종 + D가지 확장 노드
        // 체류: 기본 대비 +15% dwell (심화 콘텐츠 소화 시간)
    // 비집중 서브층: QF 부스트로 빠른 재통과 (기존 페이스)
```

### 5.3 예외·엣지

| 조건 | 처리 |
|---|---|
| 빅 크런치 도중 크래시 (단계 4~8) | §6.3 복구: `prestige_type=="big_crunch"` → QF_pending_gain 재적용, run_index 정합 확인 |
| 집중 서브층 선택 없이 강제 진행 | 불허. 선택 UI를 차단 모달로 구현 (run_index >= 2 한정) |
| `run_index >= 7` (7회차+ 자유 선택) | 이전 선택 제약 없이 6개 중 자유 선택 허용 |
| `D_preservation_curve` 키 초과 | `run_index > 7` → `0.35` 하한 적용 |
| 재하강 후 lifetime_C 누적으로 QF 급증 | production_mult 갱신이 올바르게 됨 (정상). race 단조성은 economy §7.5.3에서 검증됨 |
| `r <= PLANCK_LENGTH` 조건이 Decimal 정밀도 때문에 늦게 감지 | 매 tick `r.lte(PLANCK_LENGTH_DECIMAL)` 체크 (Decimal 비교 메서드 사용) |

---

## 6. 세이브 / 로드

### 6.1 Happy Path — 세이브

```
[autoSave 스케줄러 — 수십 초 주기]

  1. 직렬화 (tech-arch §1.4)
     raw_state = serialize(game_state)
       // Decimal → .toString() 일괄 변환 (세이브 모듈 경계)
       // Set/특수값 → Array/문자열 변환

  2. 압축
     compressed = lz_string.compress(JSON.stringify(raw_state))
       // 매체별: localStorage=UTF16, fs=Base64 (어댑터가 선택)

  3. checksum 계산
     cs = checksum(compressed)     // 결정적, 빠른 알고리즘

  4. 봉투 생성
     envelope = { version: CURRENT_VERSION, data: compressed, checksum: cs }

  5. 임시 파일에 쓰기 (원자적 쓰기, tech-arch §1.8)
     write_temp(envelope)
     rename_to_main()              // 성공 시 교체

  6. 롤링 백업 회전
     backup.3 = backup.2
     backup.2 = backup.1
     backup.1 = 이전 메인

  7. lastSave 갱신
     lastSave = Date.now()         // 세이브 파일 + Cloud 양쪽
```

### 6.2 Happy Path — 로드

```
[게임 시작 또는 수동 로드]

  1. 봉투 파싱
     envelope = parse(read_raw())
     if envelope == null: → 첫 실행 처리 (§6.4)

  2. 버전 체크
     if envelope.version > CURRENT_VERSION:
         경고 UI: "더 새로운 저장 파일. 업데이트 필요."
         로드 중단 (다운그레이드 방지)

  3. checksum 검증
     cs_actual = checksum(envelope.data)
     if cs_actual != envelope.checksum:
         → 손상/편집 감지 (§6.3 예외 처리)

  4. 압축 해제
     decompressed = lz_string.decompress(envelope.data)
     raw_state = JSON.parse(decompressed)

  5. 마이그레이션 체인
     while raw_state.version < CURRENT_VERSION:
         raw_state = migrations[raw_state.version](raw_state)

  6. 검증 (validate)
     누락 필드 → 기본값 주입
     NaN / null Decimal → 0 또는 Decimal("0") 치환
     범위 외 값 → 클램프 (예: N_prestige < 0 → 0)

  7. Decimal 재구성
     Decimal 필드 전체를 .toString() → new Decimal() 역변환

  8. 파생값 재계산
     production_mult, dec, r, holographic_mult 등 저장하지 않는 파생값 전부 재계산

  9. 오프라인 계산 실행 (§7)
     lastSave로부터 elapsed 계산 → 오프라인 복귀 흐름

  10. 게임 루프 시작
```

### 6.3 세이브 손상 복구 흐름

```
checksum 불일치 또는 JSON 파싱 실패:
    1. 손상 파일을 *.corrupt.bak 로 보존 (침묵 삭제 절대 금지)
    2. backup.1 로드 시도 → checksum 검증 → 성공이면 복구 완료
    3. backup.1 실패 → backup.2 시도
    4. backup.2 실패 → backup.3 시도
    5. 모든 백업 실패 → 첫 실행 처리 (§6.4) + UI 알림: "저장 파일 손상, 새 게임 시작"
    6. 복구 성공 시 UI 알림: "이전 저장에서 복구됨"

미완료 상전이 복구 (prestige_in_progress == True):
    // 크래시가 단계 2~7(§4.1) 사이에 발생한 경우
    prestige_type == "phase_transition":
        QF_claimed = QF_claimed + QF_pending_gain   // 미반영 QF 재적용
        리셋 상태 확인:
            E / C / chain.bought = 0 이어야 함
            그렇지 않으면 강제 0으로 정합
        phase_transition_available = False
        prestige_in_progress = False
    prestige_type == "big_crunch":
        동일 패턴 + run_index 정합 확인

클라우드 / 동시 탭 충돌:
    로컬 lastSave vs Cloud lastSave 비교
    더 최신(큰) lastSave의 세이브를 채택
    동일 timestamp면 QF 기준 더 진행된 쪽 채택
    UI 알림: "클라우드 저장 충돌 — 최신 저장으로 복원"
```

### 6.4 첫 실행 (세이브 없음)

```
세이브 파일 없음 / 모든 백업 실패:
    game_state = DEFAULT_STATE
    DEFAULT_STATE:
      version: CURRENT_VERSION
      resources: { E:0, C:0, D_current:0, QF:0, lifetime_C:0, D_lifetime:0 }
      chain: { bought: [0,0,0,0,0,0,0,0] }
      prestige: { N_prestige:0, run_index:1, QF_claimed:0, current_run_focus:null }
      layers: { current_layer: MOLECULE, next_layer: ATOM }
      codex: { discovered: [], timestamps: {} }
      research: { purchased: [] }
      settings: { ... defaults ... }
    FTUE 플래그 설정 → 첫 5분 온보딩 시퀀스 진입
```

### 6.5 예외·엣지

| 조건 | 처리 |
|---|---|
| localStorage 용량 초과 (웹) | IndexedDB fallback 어댑터로 자동 전환 (tech-arch §1.5) |
| fs 쓰기 실패 (Steam, 디스크 꽉 참) | 오류 알림 UI, 재시도 로직(N회). 메모리 상태는 유지 |
| lz-string 인코딩 혼용 | 어댑터가 매체별 단일 방식 강제 — 게임 코드에서 직접 compress 호출 금지 |
| JSON.parse 실패 (truncation) | 파싱 예외 catch → §6.3 손상 복구 흐름 |
| `new Decimal(str)` 실패 (오염된 문자열) | try-catch → validate에서 기본값 0으로 대체 |
| 버전이 없는 구 세이브 (version 필드 누락) | `version = 0` 가정 → 마이그레이션 체인 시작 |

---

## 7. 오프라인 복귀

### 7.1 Happy Path — 일괄 지급 (기본)

```
[로드 완료 후 / 복귀 감지 시]

  1. elapsed 계산 (단일 진입점, tech-arch §3.2)
     last_save_ts = max(local_lastSave, cloud_lastSave)
     raw_elapsed  = Date.now() - last_save_ts
     if raw_elapsed < 0: raw_elapsed = 0    // 음수 클램프 (시계 역주행 방어)

  2. 탬퍼 클램프 (48h 하드 상한)
     elapsed_clamp = min(raw_elapsed, CAP * TAMPER_MULT)   // = min(_, 48h)
     capped        = min(elapsed_clamp, CAP)               // = min(_, 24h)

  3. 장시간 방치 보너스
     long_idle = 1 + 0.5 * log10(1 + max(0, elapsed_clamp - CAP) / CAP)

  4. modifier 선택
     if prestige_offline_bonus_flag:            // 상전이 직후 첫 오프라인
         modifier = 1.0
         prestige_offline_bonus_flag = False    // 1회 소모
     else:
         modifier = 0.65

  5. 유효 오프라인 초
     effective_s = capped * modifier * long_idle

  6. 일괄 지급
     현재 생산 rate = chain_production_rate()  // 틱 당 C/E 생산량 (Decimal)
     C += rate_C * effective_s
     E += rate_E * effective_s
     lifetime_C += rate_C * effective_s

  7. 파생값 재계산, UI 표시
     emit("offline_credited", { elapsed_s: effective_s, modifier })
     // UI: "N시간 자리 비움. +X E, +Y C" 팝업
```

### 7.2 Happy Path — 미니 시뮬 (정밀 모드, 설정 ON 시)

```
[Web Worker 에서 실행]

  1. 상태 스냅샷을 Worker로 전달 (직렬화 후 postMessage)

  2. Worker 내부:
     sub_ticks = min(500, floor(effective_s / DT))   // 상한 1000틱 (tech-arch §3.1)
     dt_sub    = effective_s / sub_ticks
     for i in range(sub_ticks):
         mini_tick(dt_sub)            // chain 생산 + 자동구매 휴리스틱 포함

  3. Worker 결과를 메인으로 postMessage
     메인: 결과 Δ값을 실제 상태에 병합

  4. 병합 충돌 (Worker 실행 중 플레이어가 세이브 수정한 경우)
     Worker 결과 폐기, 일괄 지급 방식으로 재처리
```

### 7.3 오프라인 중 능동 메커니즘 처리

```
오프라인 rate 계산 시 메커니즘 배율:
    각 메커니즘 모듈 → getIdleBaselineMultiplier() 호출
    응집/분산/공명 평균 (위상 겹침): lang기본값 = 중간 배율
    불확정 요동: 장기 평균(양수) 적용 — 하향 요동 제외
    스핀 네트워크: 현재 topology 기반 배율 유지 (리셋 전 마지막 상태)
    핵력 게이지: 충전 속도 기반 예상 이벤트 횟수 × 스파이크 평균

// 오프라인 중 불리한 이벤트 불발 원칙
// → 자리 비웠는데 손해 절대 없음 (tech-arch §3.4)
```

### 7.4 예외·엣지

| 조건 | 처리 |
|---|---|
| `elapsed > 48h` (시계조작 또는 매우 장기 방치) | 탬퍼 클램프 48h → effective_s 상한 = 48×3600×0.65×long_idle ≈ 17.95h 등가 |
| `raw_elapsed < 0` (시계 역주행) | 0 클램프, 일체 지급 없음 |
| `last_save_ts == 0` (첫 실행 직후) | elapsed = 0, 오프라인 계산 스킵 |
| Web Worker 지원 없음 (구형 브라우저) | 일괄 지급으로 폴백, 정밀 모드 옵션 숨김 |
| 미니 시뮬 중 브라우저 탭 닫힘 | Worker 종료, 재오픈 시 일괄 지급으로 처리 |
| 오프라인 계산 중 상전이 임계값 도달 | 오프라인 계산은 상전이를 자동 실행하지 않음 — 복귀 후 UI로 확인 제공 |

---

## 8. 도감 발견

### 8.1 Happy Path

```
[입자 발견 이벤트 — 트리거는 다양]
트리거 소스:
  A. 층 진입 시 해당 층 입자군 체크
  B. 메커니즘 이벤트 (핵결합, 하모닉 공명 등)
  C. 압축 깊이 마일스톤 도달
  D. 집중 서브층 심화 콘텐츠 해금 (재하강 §5.2)

[on particle_discovered 이벤트]
  1. 중복 체크
     if particle_id in codex.discovered: 이미 발견됨, 스킵

  2. 도감에 추가
     codex.discovered.add(particle_id)
     codex.timestamps[particle_id] = Date.now()

  3. D 보너스 지급
     D_current += particle.discovery_D_bonus   // 일회성, 큰 값

  4. 완성도 갱신
     codex_completion = len(codex.discovered ∩ DISCOVERABLE_PARTICLES) / 76
     // LEGENDARY 11개 제외, 분모=76 (economy §7.1)

  5. holographic_mult 캐시 무효화
     holo_cache = DIRTY    // 완성도 변화 → 다음 tick에서 재계산

  6. UI 알림
     emit("codex_entry_unlocked", { particle_id, rarity, D_bonus })
     // 도감 탭 배지, 발견 팝업, SFX

  7. Research Branch D 위상 심화 노드 체크
     층별 새 노드 자동 해금 조건 확인 (systems §3-4)
```

### 8.2 holographic_mult 계산 (정보층 활성 시)

```
// L10(정보층, dec25+)에서만 활성 (systems §2-I)
compute_holographic_mult():
    if current_layer < INFO_LAYER:
        return 1.0

    // D항 (별도 서브예산)
    D_total = D_current + D_lifetime
    D_bonus = log10(D_total.add(1)) * 0.008    // holo_factor=0.008, 상한 +5.8%

    // codex항 (곡선 B, economy §7.1)
    c = codex_completion   // 0~1
    codex_bonus = min(c * c * 0.35, 0.35)

    return Decimal(1.0).add(D_bonus).add(codex_bonus)
    // 상한 ≤ ×1.35 (codex 만렙) ~ ×1.408 (D항 포함 worst)
    // economy §7.2.3: dec26 단축 worst −28.5% < 30% PASS
```

### 8.3 예외·엣지

| 조건 | 처리 |
|---|---|
| 동일 입자 중복 발견 이벤트 | 중복 체크 (단계 1)로 무시 |
| LEGENDARY 입자 (11개) 발견 | codex.discovered에 추가되나 완성도 분모(76)에 포함 안 됨 — 별도 LEGENDARY 컬렉션 표시 |
| 재하강 후 도감 보존 | codex는 완전 보존 (systems §5-2). 리셋 대상 아님 |
| 심화 입자 발견 (집중 서브층) | 일반 발견과 동일 흐름, 단 `deep_content` 레지스트리(systems §2-K) 참조 |

---

## 9. 연구 노드 구매 · 효과 적용

### 9.1 Happy Path

```
[플레이어: 연구 노드 클릭]

  1. 구매 가능 체크
     a. D_current >= node.cost (Decimal 비교)
     b. node.id not in research.purchased
     c. node.unlock_condition 충족
        (층 진입 / 상전이 횟수 / 선행 노드 구매 등)

  2. D 차감 + 구매 기록
     D_current -= node.cost
     research.purchased.add(node.id)

  3. 효과 적용 (systems C안 기준)
     Branch A 티어 배율 노드: chain.tier_mult[k] *= factor   (캐시 무효화)
     A13 체인 연속 강화:       chain.continuity_bonus += 0.01  (체인 내부, 상수곱 아님)
     B8 3중 시너지 조건부:     synergy_flag = True              (tick 내 조건 체크 시 사용)
     B12 이벤트 D·QF 트리클:  event_trickle_mult = 1.5         (이벤트 핸들러에 반영)
     Branch C 자동화 해금:     mechanic.auto_unlock(node.id)
     Branch D 위상 심화:       mechanic.apply_depth(node.id)

  4. research_mult는 변경하지 않음 (C안: research_mult ≈ 1.0 고정)

  5. 이벤트 발행
     emit("research_purchased", { node_id: node.id, branch: node.branch })
     → UI: 연구 트리 갱신, 다음 노드 해금 표시
```

### 9.2 효과 적용 타이밍

```
즉시 적용:
  - 체인 배율 노드: 적용 즉시 production_mult 캐시 무효화 → 다음 tick에 반영
  - 자동화 해금: mechanic 모듈이 즉시 자동 타이머 시작

조건부 적용 (B8):
  - tick 내에서 "세 메커니즘 동시 활성" 조건 충족 시 dC/dt ×1.20 적용
  - 조건 미충족 시 무효 (상수곱 아님)

이벤트 트리클 (B12):
  - 메커니즘 이벤트 핸들러에서 D/QF 트리클에 1.5 곱
  - 이벤트 발생 시에만 효과 (상시 곱 아님)
```

### 9.3 예외·엣지

| 조건 | 처리 |
|---|---|
| D_current 부족 | "D 부족" UI 피드백, 구매 거부 |
| 선행 노드 미구매 | `unlock_condition` 검증 실패 → 버튼 비활성 (UI 레벨 방어) + 서버 레벨 재검증 |
| 상전이 후 연구 보존 | research.purchased는 완전 보존 (systems §5-2). 단, 새 층 노드는 새 D 필요 |
| 같은 노드 중복 구매 | 단계 1b에서 이미 구매됨 확인 → 거부 |
| 자동화 해금 조건 타이밍 (층 진입 후 X분) | 메커니즘 모듈이 진입 timestamp 보관, 조건 충족 시 unlock 허용 |

---

## 10. 예외·엣지 조건 총람

### 10.1 세이브 관련 예외

| 예외 | 탐지 방법 | 처리 |
|---|---|---|
| **체크섬 불일치** | load 시 `checksum(data) != envelope.checksum` | 백업 폴백 체인 (backup.1 → .2 → .3 → 새 게임) + UI 알림 |
| **JSON 파싱 실패** | try-catch | 동일 백업 폴백 + `.corrupt.bak` 보존 |
| **버전 > CURRENT** | `envelope.version > CURRENT_VERSION` | 로드 중단, 업데이트 안내 |
| **마이그레이션 실패** | try-catch in migration chain | 원본 raw 보존, 오류 내용 UI 표시, 수동 복구 안내 |
| **Decimal 파싱 실패** | try-catch in `new Decimal(str)` | validate에서 기본값 0 대체 |
| **동시 탭/클라우드 충돌** | lastSave timestamp 비교 | 더 최신 파일 채택, UI 알림 |
| **fs 쓰기 실패 (Steam)** | OS 에러 | N회 재시도, 실패 시 UI 알림 (메모리 상태 유지) |

### 10.2 시간·오프라인 관련 예외

| 예외 | 탐지 방법 | 처리 |
|---|---|---|
| **시계 조작 (미래로)** | `raw_elapsed > TAMPER_MULT * CAP` | 48h 탬퍼 클램프 → 최대 18h 등가 지급 |
| **시계 역주행 (음수 elapsed)** | `raw_elapsed < 0` | 0 클램프, 지급 없음 |
| **오프라인 > 48h** | elapsed 자체 | 클램프 적용, long_idle_bonus로 부분 보상 |
| **오프라인 중 상전이 임계값 도달** | 복귀 후 dec 확인 | 자동 처리 안 함 — UI로 확인 제공 |
| **백그라운드 탭 스로틀** | visibilitychange 이벤트 | 오프라인 경로 전환 (§7), 복귀 시 일괄 처리 |

### 10.3 상전이·빅 크런치 관련 예외

| 예외 | 탐지 방법 | 처리 |
|---|---|---|
| **상전이 도중 크래시** | `prestige_in_progress == True` on load | QF_pending_gain 재적용, 리셋 상태 정합 후 정상화 |
| **빅 크런치 도중 크래시** | `prestige_type == "big_crunch"` | 동일 + run_index 정합 확인 |
| **이중 상전이 클릭** | 버튼 즉시 비활성 + flag check | 진입 즉시 `phase_transition_available = False` |
| **QF_gain == 0 상전이** | QF_gain 계산 결과 | 허용 (경고 UI), 강제 차단 없음 |

### 10.4 BigNumber 관련 예외

| 예외 | 탐지 방법 | 처리 |
|---|---|---|
| **Decimal NaN** | `.isNaN()` 체크 | validate에서 기본값 0 클램프 |
| **Decimal Infinity** | `.isFinite()` 체크 | 발생하면 안 됨 (break_eternity 설계 상), 방어선으로 클램프 |
| **native number로 게임 수치 연산** | 코드리뷰·린트 | 금지 패턴: `+`, `*`, `Math.pow` 직접 사용 → `.add()`, `.mul()`, `.pow()` 강제 |
| **Decimal 직렬화 누락 (.toString() 생략)** | JSON.stringify 결과에 `{}` 나타남 | 세이브 모듈 경계에서 일괄 처리 (§6.1 단계 1) |

### 10.5 첫 실행 관련

| 예외 | 탐지 방법 | 처리 |
|---|---|---|
| **세이브 파일 없음** | `read_raw() == null` | DEFAULT_STATE 생성 + FTUE 시작 |
| **모든 백업 실패** | 백업 체인 전부 체크섬 불일치 | DEFAULT_STATE + UI 알림 "저장 손상, 새 게임 시작" |
| **설정 파일만 있고 게임 세이브 없음** | 게임 세이브 누락 | 설정 유지, 게임 DEFAULT_STATE |

### 10.6 장기 방치·재접속 관련

| 예외 | 조건 | 처리 |
|---|---|---|
| **1주 이상 미접속** | elapsed > 7일 (탬퍼 클램프로 48h 이상은 동일) | 클램프 그대로. 복귀 UI에 "N일 자리 비움, 최대 N시간 지급" 명시 |
| **재하강 후 긴 방치** | 일반 오프라인과 동일 | 회차와 무관하게 동일 오프라인 공식 |
| **첫 오프라인 (상전이 직후)** | `prestige_offline_bonus_flag == True` | modifier=1.0 적용 (1회성), economy §3.2 |

---

## 11. 상태 머신

### 11.1 핵심 게임 상태 전이 다이어그램

```
                    ┌─────────────────────────────────────┐
                    │         INITIAL / FIRST_RUN          │
                    │   (세이브 없음 / 첫 실행)             │
                    └──────────────┬──────────────────────┘
                                   │ DEFAULT_STATE 생성
                                   ▼
            ┌──────────────────────────────────────────────────┐
            │                 RUN_ACTIVE                        │
            │  알려진 물리 온보딩 (dec0~19)                     │
            │  미지 서브층 탐사 (dec19~26)                     │
            │                                                   │
            │  ┌─────────────┐      ┌──────────────────────┐  │
            │  │ LAYER_ENTER │      │  PHASE_TRANS_READY   │  │
            │  │ (자동, 리셋X)│      │ (미지 서브층 벽 도달) │  │
            │  └──────┬──────┘      └──────────┬───────────┘  │
            │         │ 도감·내러티브 발화       │              │
            │         │                         │ 플레이어 선택 │
            │         ▼                         ▼              │
            │    [RUN_ACTIVE 유지]     ┌─────────────────┐     │
            │                          │  PRESTIGE_EXEC  │     │
            │                          │ (리셋 실행 중)  │     │
            │                          │ prestige_in_    │     │
            │                          │ progress=True   │     │
            │                          └────────┬────────┘     │
            └───────────────────────────────────│───────────────┘
                                                │
                          ┌─────────────────────┴──────────────────────┐
                          │                                              │
                    PT1~PT6 완료                                   PT7 빅 크런치
                          │                                              │
                          ▼                                              ▼
            ┌─────────────────────────┐              ┌──────────────────────────┐
            │   RUN_ACTIVE            │              │  BIG_CRUNCH_SELECT       │
            │   (다음 미지 서브층)     │              │  집중 서브층 선택 UI     │
            │   production_mult 증가  │              │  (run_index >= 2 한정)   │
            └─────────────────────────┘              └──────────┬───────────────┘
                                                                 │ 선택 완료
                                                                 ▼
                                                  ┌──────────────────────────┐
                                                  │   PRESTIGE_EXEC          │
                                                  │   (빅 크런치 리셋 실행)  │
                                                  └──────────────┬───────────┘
                                                                 │ 완료
                                                                 ▼
                                                  ┌──────────────────────────┐
                                                  │   RUN_ACTIVE             │
                                                  │   dec0 재시작            │
                                                  │   run_index++            │
                                                  │   집중 서브층 콘텐츠 회전│
                                                  └──────────────────────────┘
```

### 11.2 오프라인 상태 전이

```
RUN_ACTIVE
    │ visibilitychange(hidden) or 탭 닫힘
    ▼
OFFLINE
    │ 복귀 / 로드
    ▼
OFFLINE_CALC         ← 오프라인 계산 실행 (§7)
    │ 완료
    ▼
RUN_ACTIVE           ← elapsed credit 반영 후 재개
```

### 11.3 세이브 상태 전이

```
RUN_ACTIVE
    │ autoSave 주기 도달
    ├──→ SAVING → (성공) → RUN_ACTIVE
    │             (실패) → SAVE_ERROR → 재시도 N회 → RUN_ACTIVE (메모리 상태 유지)

애플리케이션 시작
    │
    ├──→ LOAD_CHECK
    │         │ 세이브 있음 → LOAD_VALIDATE → (PASS) → OFFLINE_CALC → RUN_ACTIVE
    │         │                             → (FAIL) → LOAD_CORRUPT → 백업 폴백
    │         │ 세이브 없음 → FIRST_RUN → RUN_ACTIVE
    │
    └──→ PRESTIGE_EXEC (prestige_in_progress 잔여) → 복구 → RUN_ACTIVE
```

---

## 12. 결정성

### 12.1 재현성 원칙

economy 시뮬(`economy.md` §1.2, sim/campaign6.py)이 검증한 페이싱 수치가 실제 게임에서 재현되려면 tick 연산이 **결정적**이어야 한다: 같은 입력(초기 상태 + dt 시퀀스) → 같은 출력.

```
결정성 요건:
  1. 고정 dt (DT 상수, economy 시뮬 dt=1~2s와 정합)
  2. Decimal 연산 순서 고정 (tier 8→1 역순 패스)
  3. 랜덤 이벤트(불확정 요동 §2-H)는 시드 기반 PRNG — 재현 가능
  4. 오프라인 계산: elapsed → effective_s 변환은 economy §3.1 공식 그대로 (분기 없음)
  5. 구매 타이밍: 닫힌형 공식이라 "어느 tick에 구매하나"가 결과에 영향. 
     시뮬의 "고티어 우선 전액 투입" 가정을 기본 자동구매 휴리스틱으로 구현
```

### 12.2 Economy 시뮬과의 정합 체크리스트

```
구현 시 검증 항목 (economy §5.1 검증됨 항목과 대조):

□ 첫 상전이 타이밍 4.26h (mult=1 단일런) 재현
□ 6벽 all ≥4h 체류 재현 (캠페인 부스트 포함)
□ 빅 크런치 진입 production_mult 2.76× 재현
□ 오프라인 크레딧 곡선 (24h=65%, 48h 클램프) 재현
□ 마일스톤 ×2/×3/×5/×7 미구현 확인 (−72% 파괴 항목 금지)
□ holographic_mult 상한 ×1.35 준수 (codex 만렙 기준)
□ research_mult = 1.0 유지 (C안 시스템 확인)
□ D_preservation_curve 회차별 적용 확인
```

### 12.3 float 드리프트 방지

```
Decimal 누산 드리프트:
  - lifetime_C는 매 틱 증분을 더하는 방식
  - 수백만 틱 후 부동소수 오차가 누적될 수 있음
  - break_eternity의 내부 표현이 mantissa+exponent라 각 연산은 정확
  - 단, 비교(dec >= wall)는 .gte() 사용 필수 (== 비교 금지)

DT 드리프트:
  - 누산기 기반이라 실 경과시간과 게임시간 오차는 DT 이하
  - 장시간 구동해도 dt 누산이 아니라 실경과시간 기반이라 드리프트 없음
```

---

## 13. R1~R9 리스크 매핑

tech-architecture §7의 R1~R9가 각 시스템 흐름의 어느 단계에 영향하는지 매핑한다.

| 리스크 | 내용 | 관련 흐름 | 완화 (이 문서 어느 단계) |
|---|---|---|---|
| **R1** | break_eternity 직렬화 표현 변경 | §6 세이브/로드 | §6.1 단계 1: Decimal→toString() 세이브 경계 단일 캡슐화. §6.2 단계 5: 마이그레이션 체인 |
| **R2** | lifetime_C가 break_infinity 한계 초과 | §1 Tick, §4·§5 상전이·빅 크런치 | 처음부터 break_eternity 채택. lifetime_C 갱신(§1.1 단계 2)이 Decimal 경로 |
| **R3** | 미니 시뮬/오프라인 CPU 스파이크 | §7 오프라인 복귀 | §7.2 단계 2: sub_ticks 상한 1000, Web Worker 오프로드 |
| **R4** | 시계 조작 익스플로잇 | §7 오프라인 복귀 | §7.1 단계 1~2: 단일 진입점 클램프, lastSave 최댓값 채택, 48h 하드 상한 |
| **R5** | 세이브 손상 (반쪽 쓰기·클라우드 충돌) | §6 세이브/로드 | §6.1 단계 5: 원자적 쓰기+교체. §6.3: 백업 폴백 체인. §10.1: 예외 처리 |
| **R6** | NW.js 소스 노출·캐주얼 치팅 | 전체 | 접근성 우선 정책, nwjc 바이트코드 후속 결정 (이 문서 범위 밖) |
| **R7** | 메커니즘 모듈 직렬화 누락 | §6 세이브/로드, §1 Tick | §6.2 단계 7: validate에서 기본값 주입. 각 메커니즘 모듈 serialize/deserialize 인터페이스 의무 (§6.2 단계 8) |
| **R8** | D_total magnitude 미확정 → holo_factor 재튜닝 필요 | §8 도감 발견 | §8.2: holo_factor=0.008 현재값. stats에 D_total 추적(§1.1). 실측 후 economy 재시뮬(후속) |
| **R9** | 고정 timestep dt와 economy 시뮬 dt 불일치 | §1 Tick | §12.1: DT를 economy 시뮬 dt=1~2s와 정합되게 선택. §12.2: 체크리스트로 검증 |

---

## 끝 한 줄 요약

이 문서는 9개 시스템 흐름(생산 tick·구매·층 진입·상전이·빅 크런치·세이브·오프라인·도감·연구)의 단계별 시퀀스와, 각 흐름에서 발생 가능한 예외(세이브 손상·오프라인 조작·크래시 복구·BigNumber·첫 실행·클라우드 충돌)의 처리를 확정하며, R1~R9 리스크가 각 흐름의 어느 단계에 완화되는지 매핑한다.

**핵심 4줄:**
1. 흐름 9개: 생산 tick(고정 dt) / 구매(닫힌형) / 층 진입·상전이(분리) / PT1 QF획득 / 빅 크런치 재하강 / 세이브·로드 / 오프라인 복귀 / 도감 발견 / 연구 노드
2. 예외 카테고리: 세이브 손상·시계조작·상전이 크래시·BigNumber·첫 실행·클라우드 충돌·오프라인 조작·장기 방치 — 모두 탐지 방법 + 처리 명시
3. R1~R9 매핑: R1(직렬화)→§6, R2(BigNum)→§1·§4·§5, R3(CPU)→§7, R4(시계)→§7, R5(손상)→§6, R7(직렬화 누락)→§6·§1, R8(D_total)→§8, R9(dt 정합)→§1·§12
4. 상태 머신: FIRST_RUN → RUN_ACTIVE ↔ PRESTIGE_EXEC ↔ BIG_CRUNCH_SELECT → RUN_ACTIVE(재하강) / OFFLINE 분기 / SAVING·LOAD_VALIDATE 보조 상태
