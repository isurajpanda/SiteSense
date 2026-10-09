import * as React from 'react';
import { cn } from '@/lib/utils';

export function DropdownMenu({
  trigger,
  children,
  align = 'end',
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'end' | 'center';
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <span onClick={() => setOpen((o) => !o)} className="inline-flex cursor-pointer">
        {trigger}
      </span>
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-1 min-w-[180px] rounded-md border border-border bg-[#0a0a0a] p-1 shadow-xl',
            align === 'end' ? 'right-0' : align === 'start' ? 'left-0' : 'left-1/2 -translate-x-1/2',
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  onSelect,
  className,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  className?: string;
}) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent focus-visible:outline-none',
        className,
      )}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}
