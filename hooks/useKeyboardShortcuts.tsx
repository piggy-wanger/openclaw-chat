"use client";

import { useEffect, useCallback, useRef } from "react";

export type KeyboardShortcutHandlers = {
  onFocusSearch?: () => void;
  onNewSession?: () => void;
  onCloseModal?: () => void;
};

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const handlersRef = useRef(handlers);

  // Update ref in effect to avoid accessing during render
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { key, ctrlKey, metaKey } = event;
    const isCtrlOrCmd = ctrlKey || metaKey;

    // Ctrl+K or / : Focus search
    if ((isCtrlOrCmd && key === "k") || (key === "/" && !isCtrlOrCmd)) {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement;

      // Don't trigger "/" shortcut when typing in input
      if (key === "/" && isInputFocused) {
        return;
      }

      event.preventDefault();
      handlersRef.current.onFocusSearch?.();
      return;
    }

    // Ctrl+N : New session
    if (isCtrlOrCmd && key === "n") {
      event.preventDefault();
      handlersRef.current.onNewSession?.();
      return;
    }

    // Escape : Close modal
    if (key === "Escape") {
      handlersRef.current.onCloseModal?.();
      return;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
