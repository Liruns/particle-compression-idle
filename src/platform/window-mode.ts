/**
 * platform/window-mode — Tauri 창을 위젯 ↔ 게임 모드로 변형(tech-arch §5.2 platform 격리).
 *
 *  위젯: 프레임리스·투명 위·always-on-top·태스크바 숨김·소형(380²) — 바탕화면 스티커.
 *  게임: 일반 창(테두리·리사이즈·태스크바·1280×720, ui-flow §12-A 최소 900×600).
 *
 *  이 모듈은 **동적 import 전용**(웹 번들에 로드 안 됨 — 호출부가 isTauriDesktop 가드 후 lazy 로드).
 *  창 모양만 바꾼다 — 게임 로직 0 접점. 라우팅(해시/리로드)은 호출자(App) 책임.
 */
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';

export type WindowMode = 'widget' | 'game';

/** 창 속성을 모드에 맞게 전부 적용(크기 포함). 모드 전환 시 사용. */
export async function applyTauriWindowMode(mode: WindowMode): Promise<void> {
  const win = getCurrentWindow();
  if (mode === 'game') {
    await win.setAlwaysOnTop(false);
    await win.setSkipTaskbar(false);
    await win.setDecorations(true);
    await win.setMinSize(new LogicalSize(900, 600));
    await win.setSize(new LogicalSize(1280, 720));
    await win.center();
  } else {
    await win.setDecorations(false);
    await win.setAlwaysOnTop(true);
    await win.setSkipTaskbar(true);
    await win.setMinSize(new LogicalSize(220, 220));
    await win.setSize(new LogicalSize(380, 380));
  }
}

/**
 * 부팅 정규화: 직전 세션을 다른 모드로 끝냈으면(window-state가 그 크기/모양을 복원)
 * 현재 모드와 창 흔적이 어긋난다 → decorations 불일치를 감지해 전체 재적용.
 * 일치하면 손대지 않는다(사용자가 조절한 위젯 크기·위치 존중 — window-state 복원 유지).
 */
export async function normalizeTauriWindowMode(mode: WindowMode): Promise<void> {
  const win = getCurrentWindow();
  const decorated = await win.isDecorated();
  const expected = mode === 'game';
  if (decorated !== expected) await applyTauriWindowMode(mode);
}
