/**
 * save — F게이트 F1: 세이브 봉투·직렬화·압축·마이그레이션·체크섬·StorageAdapter 조립.
 * (tech-architecture.md §1 전체)
 *
 * 세이브는 신성하다(§1). 세 위협을 동시에 막는다:
 *   (A) 포맷 진화로 인한 구버전 깨짐 → 봉투 version + 단방향 마이그레이션(§1.3, migrations.ts)
 *   (B) 파일/문자열 손상 → checksum + 백업 폴백(§1.7-1, §1.8)
 *   (C) 변조(시계조작·편집) → checksum + lastSave(§1.7, offline 모듈이 소비)
 *
 * 봉투 포맷(§1.2, 1일차 고정):
 *   { version:<정수>, data:<문자열 JSON>, checksum:<문자열> }
 *   - version은 봉투 바깥 평문(어느 버전인지 먼저 알아야 풀 수 있으므로).
 *   - data는 SaveData(평문 JSON)를 직렬화한 문자열. 압축은 **어댑터가** 담당(§1.4 매체별 인코딩).
 *   - checksum은 data 문자열에 대한 FNV-1a(편집 탐지).
 *
 * 책임 경계: 이 모듈은 "봉투 ↔ GameState" 변환과 무결성/마이그레이션을 담당.
 *   실제 매체 쓰기·압축 인코딩은 StorageAdapter(§1.6)에 위임 → 웹/Steam 이식이 게임 코드를 안 건드림.
 */

import type { StorageAdapter } from './adapters';
import { checksum, verifyChecksum } from './checksum';
import {
  serializeState,
  deserializeState,
  type SaveData,
} from './serialize';
import {
  CURRENT_SCHEMA_VERSION,
  runMigrations,
} from './migrations';
import { type GameState, createInitialState } from '../state';

/** 메인 세이브 키. 어댑터가 이 키로 매체에 기록. */
export const SAVE_KEY = 'micro_idle_save';

/** 봉투(§1.2). version은 평문 바깥. */
export interface SaveEnvelope {
  version: number;
  data: string;
  checksum: string;
}

/** 로드 결과 종류 — 상위(UI)가 사용자에게 알릴 수 있게 구분. */
export type LoadResult =
  | { kind: 'loaded'; state: GameState }
  | { kind: 'fresh'; state: GameState } // 세이브 없음 → 새 게임
  | { kind: 'recovered'; state: GameState } // 메인 손상 → 백업에서 복구
  | { kind: 'corrupt'; state: GameState; reason: string }; // 복구 실패 → 새 게임 + 원본 보존

/**
 * SaveManager — 어댑터 주입형(§1.6). 게임 코드는 save()/load()만 호출.
 */
export class SaveManager {
  constructor(private readonly adapter: StorageAdapter) {}

  // --- 봉투 빌드/파싱 (§1.2) ---------------------------------------------------

  /** GameState → 봉투 문자열(어댑터에 넘길 최종 형태). */
  buildEnvelope(state: GameState): string {
    const payload: SaveData = serializeState(state);
    const data = JSON.stringify(payload);
    const env: SaveEnvelope = {
      version: CURRENT_SCHEMA_VERSION,
      data,
      checksum: checksum(data),
    };
    return JSON.stringify(env);
  }

  /**
   * 봉투 문자열 → GameState. 무결성·버전·마이그레이션을 모두 적용(§1.3 로드 흐름).
   * 실패 시 예외를 던져 상위(load)가 백업 폴백/corrupt 처리하게 한다.
   */
  parseEnvelope(raw: string): GameState {
    const env = JSON.parse(raw) as Partial<SaveEnvelope>;

    if (typeof env.version !== 'number' || typeof env.data !== 'string') {
      throw new Error('Malformed envelope (missing version/data).');
    }

    // 다운그레이드 방지(§1.3): 더 새로운 세이브는 안전 거부.
    if (env.version > CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `Save version ${env.version} is newer than supported ${CURRENT_SCHEMA_VERSION}.`,
      );
    }

    // 편집 탐지(§1.7-1): checksum 불일치는 손상으로 간주.
    if (typeof env.checksum === 'string' && !verifyChecksum(env.data, env.checksum)) {
      throw new Error('Checksum mismatch (corrupt or edited save).');
    }

    // 평문 파싱 → 마이그레이션(v→현재) → Decimal 복원
    const rawObj = JSON.parse(env.data) as Record<string, unknown>;
    const migrated = runMigrations(rawObj, env.version);
    return deserializeState(migrated as unknown as SaveData);
  }

  // --- 저장/로드 (어댑터 위임) --------------------------------------------------

  /**
   * 저장. 백업 회전 후 메인 기록(§1.8). lastSave 갱신은 호출 측 책임
   * (state.meta.lastSave를 채운 뒤 호출 — offline 모듈의 시간 무결성과 연결).
   */
  async save(state: GameState): Promise<void> {
    await this.adapter.backup(SAVE_KEY);
    const envelope = this.buildEnvelope(state);
    await this.adapter.write(SAVE_KEY, envelope);
  }

  /**
   * 로드. 흐름(§1.3):
   *   메인 읽기 → 파싱 시도 → 실패 시 백업 슬롯 순차 시도 → 모두 실패면 새 게임(+corrupt 보존).
   */
  async load(): Promise<LoadResult> {
    const raw = await this.adapter.read(SAVE_KEY);

    if (raw == null) {
      return { kind: 'fresh', state: createInitialState() };
    }

    // 1) 메인 시도
    try {
      return { kind: 'loaded', state: this.parseEnvelope(raw) };
    } catch (mainErr) {
      // 2) 백업 슬롯 폴백(.bak.1 → .2 → .3, §1.8)
      for (let gen = 1; gen <= 3; gen++) {
        const bak = await this.adapter.read(`${SAVE_KEY}.bak.${gen}`);
        if (bak == null) continue;
        try {
          return { kind: 'recovered', state: this.parseEnvelope(bak) };
        } catch {
          // 이 백업도 손상 → 다음 세대
        }
      }
      // 3) 전부 실패: 원본은 침묵 삭제하지 않음(§1.3). corrupt 표시 + 원본 보존.
      await this.preserveCorrupt(raw);
      return {
        kind: 'corrupt',
        state: createInitialState(),
        reason: mainErr instanceof Error ? mainErr.message : String(mainErr),
      };
    }
  }

  /** 손상 원본을 .corrupt.bak로 보존(§1.3 "절대 침묵 삭제 금지"). */
  private async preserveCorrupt(raw: string): Promise<void> {
    try {
      await this.adapter.write(`${SAVE_KEY}.corrupt.bak`, raw);
    } catch {
      // 보존 실패는 치명이 아님(이미 새 게임으로 진행) — 조용히 무시.
    }
  }

  // --- 수동 내보내기/가져오기 (§1.8) -------------------------------------------
  // 봉투 포맷 그대로 Base64로 감싸 클립보드 복사/붙여넣기(기기 이전·버그 리포트).
  // (lz-string Base64는 어댑터와 별개 경로 — export 전용. 여기선 봉투를 그대로 노출.)

  /** 현재 상태를 export 문자열로(봉투 JSON). */
  exportSave(state: GameState): string {
    return this.buildEnvelope(state);
  }

  /** export 문자열 → GameState(검증 포함). 실패 시 예외. */
  importSave(raw: string): GameState {
    return this.parseEnvelope(raw.trim());
  }
}

// 하위 모듈 재노출(편의)
export { checksum, verifyChecksum } from './checksum';
export { CURRENT_SCHEMA_VERSION } from './migrations';
export type { SaveData } from './serialize';
export type { StorageAdapter } from './adapters';
export { LocalStorageAdapter } from './adapters';
