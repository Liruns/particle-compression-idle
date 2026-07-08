/**
 * 세이브 신규 필드 파이프라인 검증 (F1 강건성 — stats·achievements 추가 필드).
 *
 * serialize.test류(serialize↔deserialize)는 이미 있으나, **전체 봉투 경로**(buildEnvelope→parseEnvelope,
 *  = checksum·version·마이그레이션 디스패치 포함)에서 신규 옵셔널 필드가 살아남는지 + 구버전 세이브(필드 없음)가
 *  깨끗이 로드되는지 + export/import 왕복이 보존하는지는 미커버였다. F1은 로드-베어링이라 여기서 못 박는다.
 */
import { describe, it, expect } from 'vitest';
import { SaveManager, SAVE_KEY, CURRENT_SCHEMA_VERSION } from '../save';
import { checksum } from '../save/checksum';
import { createInitialState } from '../state';
import type { StorageAdapter } from '../save/adapters';

class MemoryAdapter implements StorageAdapter {
  store = new Map<string, string>();
  async read(k: string) {
    return this.store.get(k) ?? null;
  }
  async write(k: string, v: string) {
    this.store.set(k, v);
  }
  async exists(k: string) {
    return this.store.has(k);
  }
  async backup(k: string) {
    const cur = this.store.get(k);
    if (cur != null) this.store.set(`${k}.bak.1`, cur);
  }
}

const mgr = new SaveManager(new MemoryAdapter());

describe('신규 필드 봉투 왕복 (stats·achievements)', () => {
  it('buildEnvelope→parseEnvelope가 stats·achievements 보존', () => {
    const s = createInitialState();
    s.stats.manualCompresses = 321;
    s.stats.totalBinds = 88;
    s.stats.maxDec = 21.5;
    s.achievements.earned.add('first_compress');
    s.achievements.earned.add('dec_first_wall');
    const back = mgr.parseEnvelope(mgr.buildEnvelope(s));
    expect(back.stats.manualCompresses).toBe(321);
    expect(back.stats.totalBinds).toBe(88);
    expect(back.stats.maxDec).toBeCloseTo(21.5, 6);
    expect(back.achievements.earned.has('first_compress')).toBe(true);
    expect(back.achievements.earned.has('dec_first_wall')).toBe(true);
    expect(back.achievements.earned.size).toBe(2);
  });

  it('구버전 세이브(stats·achievements 없음) → 체크섬 유효 + 기본값 로드', () => {
    // 신규 필드가 없던 시절의 봉투를 재현: serialize된 data에서 필드 삭제 후 체크섬 재계산.
    const s = createInitialState();
    const env = JSON.parse(mgr.buildEnvelope(s)) as { version: number; data: string; checksum: string };
    const data = JSON.parse(env.data) as Record<string, unknown>;
    delete data.stats;
    delete data.achievements;
    const legacyData = JSON.stringify(data);
    const legacyEnv = JSON.stringify({
      version: CURRENT_SCHEMA_VERSION,
      data: legacyData,
      checksum: checksum(legacyData),
    });
    const back = mgr.parseEnvelope(legacyEnv); // 체크섬 유효 → 통과, 필드는 기본값 보충
    expect(back.stats.manualCompresses).toBe(0);
    expect(back.stats.totalBinds).toBe(0);
    expect(back.stats.maxDec).toBe(0);
    expect(back.achievements.earned.size).toBe(0);
  });

  it('export/import 왕복 — 신규 필드 보존', () => {
    const s = createInitialState();
    s.stats.manualCompresses = 12;
    s.achievements.earned.add('prestige_1');
    const raw = mgr.exportSave(s);
    const back = mgr.importSave(raw);
    expect(back.stats.manualCompresses).toBe(12);
    expect(back.achievements.earned.has('prestige_1')).toBe(true);
  });

  it('save→load 통합(어댑터 경유)에서 신규 필드 보존', async () => {
    const adapter = new MemoryAdapter();
    const m = new SaveManager(adapter);
    const s = createInitialState();
    s.stats.maxDec = 9.5;
    s.achievements.earned.add('dec_quark_limit');
    await m.save(s);
    expect(adapter.store.has(SAVE_KEY)).toBe(true);
    const loaded = await m.load();
    expect(loaded.kind).toBe('loaded');
    expect(loaded.state.stats.maxDec).toBeCloseTo(9.5, 6);
    expect(loaded.state.achievements.earned.has('dec_quark_limit')).toBe(true);
  });
});

describe('손상/복구 로드 분류 (LoadResult — UI 통지의 근거)', () => {
  it('메인 체크섬 불일치 + 백업 없음 → corrupt + 원본 보존(.corrupt.bak)', async () => {
    const ad = new MemoryAdapter();
    const m = new SaveManager(ad);
    // 유효 봉투를 만든 뒤 data를 변조 → 체크섬 불일치(편집/손상 탐지 §1.7-1).
    const env = JSON.parse(m.buildEnvelope(createInitialState())) as { data: string };
    env.data = env.data.replace(/\}$/, ',"__tamper":1}');
    ad.store.set(SAVE_KEY, JSON.stringify({ version: CURRENT_SCHEMA_VERSION, ...env }));
    const res = await m.load();
    expect(res.kind).toBe('corrupt');
    expect(res.state.resources.E.eq(0)).toBe(true); // 새 게임 상태로 복귀
    expect(ad.store.has(`${SAVE_KEY}.corrupt.bak`)).toBe(true); // 원본 침묵 삭제 금지
  });

  it('메인 손상 + 유효 백업 → recovered(백업에서 복원)', async () => {
    const ad = new MemoryAdapter();
    const m = new SaveManager(ad);
    const s = createInitialState();
    s.stats.manualCompresses = 777;
    ad.store.set(SAVE_KEY, '!!! not a valid envelope !!!'); // 메인 손상
    ad.store.set(`${SAVE_KEY}.bak.1`, m.buildEnvelope(s)); // 백업 유효
    const res = await m.load();
    expect(res.kind).toBe('recovered');
    expect(res.state.stats.manualCompresses).toBe(777); // 백업 진행 복원
  });

  it('세이브 없음 → fresh(손상 아님)', async () => {
    const res = await new SaveManager(new MemoryAdapter()).load();
    expect(res.kind).toBe('fresh');
  });
});

describe('악성/손상 스칼라 정규화 (import 방어 — 체크섬 유효해도 타입 방어)', () => {
  it('count·runIndex·playtime·notation의 문자열/음수/NaN/무효값을 기본으로 정규화', () => {
    // 체크섬은 손상만 탐지(FNV, 편집 방어 아님) → 악성 편집은 통과할 수 있으므로 deserialize가 방어해야 한다.
    const env = JSON.parse(mgr.buildEnvelope(createInitialState())) as { data: string };
    const obj = JSON.parse(env.data) as {
      prestige: { count: unknown; runIndex: unknown };
      meta: { totalPlaytime: unknown };
      settings: { notation: unknown };
    };
    obj.prestige.count = 'evil'; // 문자열
    obj.prestige.runIndex = -5; // 음수
    obj.meta.totalPlaytime = NaN; // NaN(JSON 직렬화 시 null)
    obj.settings.notation = 'hacker'; // 무효 표기법
    const data = JSON.stringify(obj);
    const back = mgr.parseEnvelope(
      JSON.stringify({ version: CURRENT_SCHEMA_VERSION, data, checksum: checksum(data) }),
    );
    expect(back.prestige.count).toBe(0);
    expect(back.prestige.runIndex).toBe(0);
    expect(back.meta.totalPlaytime).toBe(0);
    expect(back.settings.notation).toBe('scientific');
  });

  it('정상 스칼라는 보존(방어가 유효값을 깎지 않음)', () => {
    const s = createInitialState();
    s.prestige.count = 3;
    s.prestige.runIndex = 2;
    s.meta.totalPlaytime = 4567.8;
    s.settings.notation = 'engineering';
    const back = mgr.parseEnvelope(mgr.buildEnvelope(s));
    expect(back.prestige.count).toBe(3);
    expect(back.prestige.runIndex).toBe(2);
    expect(back.meta.totalPlaytime).toBeCloseTo(4567.8, 3);
    expect(back.settings.notation).toBe('engineering');
  });
});
