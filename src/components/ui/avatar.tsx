import * as React from 'react';
import { cn } from '@/lib/utils';

export function Avatar({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary font-hud text-xs font-bold', className)}>
      {children}
    </div>
  );
}
