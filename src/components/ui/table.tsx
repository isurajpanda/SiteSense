import * as React from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)}>{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-border">{children}</thead>;
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return <tr className={cn('border-b border-border/50 transition-colors hover:bg-accent/40', className)}>{children}</tr>;
}

export function TableHead({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th className={cn('h-9 px-3 text-left align-middle font-hud text-xs font-semibold uppercase tracking-wider text-muted-foreground', className)}>
      {children}
    </th>
  );
}

export function TableCell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <td className={cn('px-3 py-2 align-middle', className)}>{children}</td>;
}
