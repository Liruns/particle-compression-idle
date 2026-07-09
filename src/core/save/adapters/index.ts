/**
 * save/adapters — F게이트 F2: StorageAdapter 추상화. (tech-architecture.md §1.6)
 *
 * "게임 로직은 '세이브해줘 / 불러와줘'만 호출하고, 어디에 어떻게 저장하는지는 어댑터가 결정한다."
 *
 * 어댑터 3종(LocalStorage / IndexedDB / FileSystem)이 동일 인터페이스를 구현한다.
 * 빌드 타깃(웹/Steam)에 따라 부팅 시 적절한 어댑터를 주입(§1.6).
 *   - §1.4 인코딩 규칙(UTF16 vs Base64)을 **어댑터가 책임** → 게임 코드는 인코딩을 모름.
 *   - 이식성 효과: Tauri 패키징 시 FileSystem 어댑터(Tauri fs)로 교체만 하면 됨. 게임 로직 0줄 수정.
 *
 * 1일차 고정(F2): read/write/exists/backup 4개 메서드 시그니처를 지금 박는다(roadmap §1-A).
 */

/**
 * StorageAdapter — 저장 매체 추상 인터페이스(§1.6).
 * 모든 메서드는 비동기(IndexedDB/fs가 비동기이므로 인터페이스를 비동기로 통일).
 * 어댑터가 저장하는 것은 **봉투 문자열**(save 모듈이 직렬화·인코딩한 결과)이다.
 */
export interface StorageAdapter {
  /** 키에 해당하는 저장 문자열 읽기. 없으면 null. */
  read(key: string): Promise<string | null>;
  /** 키에 저장 문자열 쓰기. (어댑터별 인코딩·원자성 책임 §1.4·§1.8) */
  write(key: string, value: string): Promise<void>;
  /** 키 존재 여부. */
  exists(key: string): Promise<boolean>;
  /** 롤링 백업: 현재 메인 세이브를 백업 슬롯으로 회전 보존(§1.8). */
  backup(key: string): Promise<void>;
}

export { LocalStorageAdapter } from './localStorage';
