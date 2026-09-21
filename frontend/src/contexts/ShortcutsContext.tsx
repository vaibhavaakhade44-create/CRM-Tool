import { createContext, useContext, useEffect, useRef, useCallback } from "react";

interface ShortcutHandlers {
  onNew?: () => void;
  onSave?: () => void;
  onClose?: () => void;
}

interface ShortcutsCtx {
  register: (handlers: ShortcutHandlers) => void;
  unregister: () => void;
}

const Ctx = createContext<ShortcutsCtx>({ register: () => {}, unregister: () => {} });

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const handlers = useRef<ShortcutHandlers>({});

  const register = useCallback((h: ShortcutHandlers) => { handlers.current = h; }, []);
  const unregister = useCallback(() => { handlers.current = {}; }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
                      (e.target as HTMLElement).isContentEditable;

      // Esc always works
      if (e.key === "Escape") { handlers.current.onClose?.(); return; }

      // Ctrl/Cmd+S = save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handlers.current.onSave?.();
        return;
      }

      // N = new (only when not in an input)
      if (!inInput && (e.key === "n" || e.key === "N") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handlers.current.onNew?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return <Ctx.Provider value={{ register, unregister }}>{children}</Ctx.Provider>;
}

export function useShortcuts(handlers: ShortcutHandlers) {
  const { register, unregister } = useContext(Ctx);
  useEffect(() => {
    register(handlers);
    return () => unregister();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers.onNew, handlers.onSave, handlers.onClose]);
}
