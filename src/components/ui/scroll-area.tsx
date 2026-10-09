import * as React from 'react';
import { cn } from '@/lib/utils';

export function ScrollArea({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('overflow-y-auto', className)} style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1a1a transparent' }}>
      {children}
    </div>
  );
}
