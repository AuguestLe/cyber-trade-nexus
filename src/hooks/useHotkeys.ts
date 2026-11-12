import { useEffect } from 'react';

export interface HotkeyHandlers {
  onPage(n: number): void;
  onPauseToggle?(): void;
  onFullscreen?(): void;
  onEscape?(): void;
  onSearchFocus?(): void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

/** 全局快捷键：1~4 切页、空格暂停、F 全屏、Esc 关抽屉。 */
export function useHotkeys(handlers: HotkeyHandlers): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      if (event.key >= '1' && event.key <= '4') {
        handlers.onPage(Number(event.key));
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        handlers.onPauseToggle?.();
        return;
      }
      if (event.key.toLowerCase() === 'f') {
        handlers.onFullscreen?.();
        return;
      }
      if (event.key === 'Escape') {
        handlers.onEscape?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
