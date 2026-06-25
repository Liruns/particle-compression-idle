/**
 * research — 연구 트리: 노드 구매·효과 적용. (research-tree.md, economy.md §7.2)
 *
 * 52연구 노드. 구매한 노드 ID 집합으로 저장(§1.1 스파스 ID 배열, 영구 보존).
 *
 * 담당(후속):
 *  - 노드 구매(D_current 소비) → 효과 적용. 효과 종류는 economy §7.2 C안:
 *    A.체인증폭(체인 내부 배율) / B.시너지(조건부 이벤트) / C.자동화 / D.위상심화.
 *    ★ A13/B8/B12는 production_mult **외부**(research_mult≈1.0) — 구현이 이 분리를 어기면
 *      (체인 내부 배율이 사실상 전역 곱이 되면) §3.4 race 재검증 필요(economy §7.2.1 경고).
 *
 * 데이터 주도(§4.4): 노드 정의 52개 + D 비용은 src/data/(JSON). research-tree 산출.
 *
 * TODO(M1.7): 체인증폭 A가지 일부(프로토타입 1~2가지) + 노드 구매·효과 적용 골격.
 */

export {}; // 스텁: 노드 구매·효과는 M1.7. C안 분리(research_mult≈1.0) 준수 필수.
