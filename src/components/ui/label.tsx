import * as React from 'react';
import { cn } from '@/lib/utils';

export function Label({ className, children, htmlFor }: { className?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('font-hud text-xs font-semibold uppercase tracking-wider text-muted-foreground', className)}>
      {children}
    </label>
  );
}
