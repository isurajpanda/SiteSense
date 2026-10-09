import * as React from 'react';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

let pushToast: ((t: Omit<Toast, 'id'>) => void) | null = null;

export function toast(t: Omit<Toast, 'id'>) {
  pushToast?.(t);
}

export function Toaster() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  React.useEffect(() => {
    pushToast = (t) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  const colors: Record<string, string> = {
    default: 'border-border',
    success: 'border-ok/50',
    warning: 'border-warn/50',
    error: 'border-crit/50',
  };

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-md border bg-[#0a0a0a]/95 p-3 shadow-xl backdrop-blur ${colors[t.variant ?? 'default']}`}
        >
          <div className="font-hud text-sm font-semibold">{t.title}</div>
          {t.description && <div className="mt-0.5 text-xs text-muted-foreground">{t.description}</div>}
        </div>
      ))}
    </div>
  );
}
