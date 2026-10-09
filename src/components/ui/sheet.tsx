import * as React from 'react';
import { cn } from '@/lib/utils';

export function Sheet({
  open,
  onOpenChange,
  children,
  side = 'right',
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: 'right' | 'left' | 'bottom';
  className?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div
        className={cn(
          'absolute flex flex-col border-border bg-[#0a0a0a]/95 backdrop-blur-xl transition-transform',
          side === 'right' && 'right-0 top-0 h-full w-full max-w-md border-l',
          side === 'left' && 'left-0 top-0 h-full w-full max-w-sm border-r',
          side === 'bottom' && 'bottom-0 left-0 w-full border-t',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('flex items-center justify-between border-b border-border p-4', className)}>{children}</div>;
}

export function SheetTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-hud text-sm font-semibold uppercase tracking-wider text-foreground">{children}</h2>;
}

export function SheetClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="Close panel"
      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3l10 10M13 3L3 13" />
      </svg>
    </button>
  );
}
