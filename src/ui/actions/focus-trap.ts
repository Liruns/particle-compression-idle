/**
 * focusTrap — 모달/패널 접근성 액션(단일 출처).
 *
 *  역할: 컨테이너가 마운트되면 내부 첫 포커스 가능 요소로 포커스를 옮기고, Tab/Shift+Tab을
 *   컨테이너 안에서 순환하도록 가둔다(초점이 뒤 배경으로 새지 않게). "가둠"만 책임진다 —
 *   닫을 때 트리거로 초점 복귀는 호출부가 담당한다(예: App.closePanel의 lastFocused.focus()).
 *   관심사 분리: 자동 등장 모달(오프라인 복귀)은 복귀할 트리거가 없으므로 복원이 불필요하다.
 *
 *  왜 공유: App(bloom 패널)·OfflineModal이 각각 동일 로직을 복붙해 두었고, 포커스 대상
 *   셀렉터까지 드리프트했다(App은 input/select/textarea 포함, 모달은 누락 — 모달에 폼 요소가
 *   생기면 트랩이 새는 잠재 버그). 하나로 통일해 드리프트 원천을 제거한다.
 */
export function focusTrap(node: HTMLElement) {
  const focusables = () =>
    Array.from(
      node.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);

  (focusables()[0] ?? node).focus();

  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (f.length === 0) {
      e.preventDefault();
      return;
    }
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  node.addEventListener('keydown', onKey);
  return {
    destroy() {
      node.removeEventListener('keydown', onKey);
    },
  };
}
