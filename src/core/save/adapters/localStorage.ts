/**
 * LocalStorageAdapter — 웹 빌드 기본 저장 매체. (tech-architecture.md §1.5·§1.6)
 *
 * §1.4 인코딩 규칙: localStorage 저장은 lz-string `compressToUTF16`(가장 효율적).
 *   **한 매체 안에서는 절대 인코딩을 섞지 않는다.** 이 어댑터는 항상 UTF16.
 *   (파일/내보내기용 Base64는 별도 경로 — save 모듈의 export/import에서.)
 *
 * §1.8 백업: 매 저장 시 직전 메인을 backup 슬롯으로 회전(.bak.1 → .2 → .3).
 *   localStorage는 동기 API라 원자적 쓰기 이슈는 작지만, 손상/오설정 대비 백업은 둔다.
 */

import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import type { StorageAdapter } from './index';

/** 롤링 백업 세대 수(§1.8: 최소 2~3세대). */
const BACKUP_GENERATIONS = 3;

export class LocalStorageAdapter implements StorageAdapter {
  /**
   * localStorage 가용성 확인(시크릿 모드·차단 환경 방어).
   * 불가하면 IndexedDB fallback으로 교체할지 boot 단계에서 판단(§1.5).
   */
  static isAvailable(): boolean {
    try {
      const k = '__micro_idle_probe__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  async read(key: string): Promise<string | null> {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    // 저장은 UTF16 압축이므로 복원도 UTF16(혼용 금지 규칙 강제).
    const decompressed = decompressFromUTF16(raw);
    // decompress 실패(null/'')는 손상으로 간주 → null 반환(상위가 백업 폴백).
    return decompressed && decompressed.length > 0 ? decompressed : null;
  }

  async write(key: string, value: string): Promise<void> {
    const compressed = compressToUTF16(value);
    localStorage.setItem(key, compressed);
  }

  async exists(key: string): Promise<boolean> {
    return localStorage.getItem(key) !== null;
  }

  async backup(key: string): Promise<void> {
    const current = localStorage.getItem(key);
    if (current == null) return;

    // 회전: .bak.{n} → .bak.{n+1} (오래된 것부터 밀어낸다)
    for (let gen = BACKUP_GENERATIONS - 1; gen >= 1; gen--) {
      const older = localStorage.getItem(`${key}.bak.${gen}`);
      if (older != null) {
        localStorage.setItem(`${key}.bak.${gen + 1}`, older);
      }
    }
    // 현재 메인 → .bak.1
    localStorage.setItem(`${key}.bak.1`, current);
  }
}
