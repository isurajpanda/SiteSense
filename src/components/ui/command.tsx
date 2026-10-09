import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  onSelect: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  items,
  placeholder = 'Type a command…',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
  placeholder?: string;
}) {
  const [query, setQuery] = React.useState('');
  const filtered = items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()));

  React.useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape') onOpenChange(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-lg border border-border bg-[#0a0a0a] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l4 4" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="h-10 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
          />
          <kbd className="rounded border border-border px-1 text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 && <div className="px-3 py-4 text-center text-sm text-muted-foreground">No results</div>}
          {filtered.map((item) => (
            <button
              key={item.id}
              className={cn(
                'flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-foreground hover:bg-accent focus-visible:outline-none',
              )}
              onClick={() => {
                item.onSelect();
                onOpenChange(false);
              }}
            >
              <span>{item.label}</span>
              {item.hint && <span className="text-xs text-muted-foreground">{item.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
