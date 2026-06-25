/**
 * data — 게임 데이터(데이터 주도). (tech-architecture.md §4.4, tech-spec §3)
 *
 * "data/ 분리 = 데이터 주도(수치는 economy/content, data-spec.md)."
 * 입자 87 · 연구 노드 52 · 층 정의 · 비용 파라미터는 코드가 아닌 데이터.
 *
 * 현재: 코어 경제 상수만(constants.ts). 입자/연구/층 JSON은 후속(content/economy 산출 주입).
 */
export * from './constants';
