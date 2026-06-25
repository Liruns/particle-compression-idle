/**
 * codex — 입자 도감: 발견 판정·보너스. (codex.md §13, systems.md, economy.md §7.1·§7.2)
 *
 * 87입자(실제 57 + 상상 30) 도감. 발견된 ID 집합으로 저장(§1.1 "집합은 ID 배열로", 스파스).
 *
 * 담당(후속):
 *  - 발견 판정(자원·층·공명 조건) → bus.emit('codexDiscover') → 영구 보존.
 *  - 완성도 = 발견수/분모. 홀로그래픽 완성도 배율(곡선 B): += completion²·0.35, 상한 ×1.35(economy §7.1).
 *    ★ 이 상한(×1.35)은 dec26 −25.9%로 race 가드레일(<30%) 안 — 임의로 올리면 밸런스 붕괴(economy §7.2).
 *  - holographic_mult D항: holo_factor=0.008, L10(정보층)에서만 활성(economy §7.2.3).
 *
 * 데이터 주도(§4.4): 입자 정의 87개는 src/data/(JSON). 발견 조건·플레이버는 content 산출.
 *
 * TODO(M1.7): 발견 판정·도감 ID 집합·완성도 계산. 보너스 배율은 economy §7 확정값 주입(임의 변경 금지).
 */

export {}; // 스텁: 도감 발견·완성도 배율은 M1.7. 데이터는 data/ JSON 주입 예정.
