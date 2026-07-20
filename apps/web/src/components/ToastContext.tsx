import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export type ToastTone = "success" | "error";
interface ToastItem { id: number; tone: ToastTone; message: string }
type ToastFn = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<ToastFn | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const push = useCallback<ToastFn>((message, tone = "success") => {
    const id = ++nextId.current;
    setToasts(current => [...current.slice(-3), { id, tone, message }]);
    window.setTimeout(() => setToasts(current => current.filter(item => item.id !== id)), 3800);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map(item => (
          <div key={item.id} className={`toast toast-${item.tone}`} role="status">
            <span className={`status-dot ${item.tone === "success" ? "status-good" : "status-critical"}`} aria-hidden="true" />
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const push = useContext(ToastContext);
  return push ?? (() => {});
}
