import * as React from 'react';

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [show, setShow] = React.useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute z-50 whitespace-nowrap rounded border border-border bg-[#0a0a0a] px-2 py-1 text-xs text-foreground ${
            side === 'top' ? 'bottom-full mb-1 left-1/2 -translate-x-1/2' : 'top-full mt-1 left-1/2 -translate-x-1/2'
          }`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
