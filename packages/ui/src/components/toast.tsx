import * as React from 'react';
import { cn } from '../cn';

/**
 * A minimal toast, deliberately not a dependency.
 *
 * Classes needs three sentences of feedback — saved, could not save, already confirmed — and a
 * toast library is a lot of bundle for that on a phone. The one thing worth being careful about
 * is announcement: the region is a polite live region that exists in the DOM from first render,
 * because a live region created at the same moment as its content is not reliably announced.
 */
export type ToastTone = 'info' | 'error';

type Toast = { id: number; message: string; tone: ToastTone };

const ToastContext = React.createContext<(message: string, tone?: ToastTone) => void>(() => {});

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const nextId = React.useRef(0);

  const push = React.useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId.current++;
    setToasts(current => [...current, { id, message, tone }]);
    setTimeout(() => {
      setToasts(current => current.filter(toast => toast.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {/* `<output>` rather than a div with role="status": it carries the role implicitly, and
          the region has to exist in the DOM from first render — one created at the same moment
          as its content is not reliably announced. */}
      <output
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto w-full max-w-sm rounded-md border px-4 py-3 text-sm shadow-lg',
              toast.tone === 'error'
                ? 'border-destructive bg-card text-destructive'
                : 'border-border bg-card text-card-foreground'
            )}
          >
            {toast.message}
          </div>
        ))}
      </output>
    </ToastContext.Provider>
  );
}
