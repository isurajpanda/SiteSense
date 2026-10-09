import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-hud font-semibold uppercase tracking-wider transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/40 bg-primary/10 text-primary',
        ok: 'border-ok/40 bg-ok/10 text-ok',
        warning: 'border-warn/40 bg-warn/10 text-warn',
        destructive: 'border-crit/40 bg-crit/10 text-crit',
        data: 'border-data/40 bg-data/10 text-data',
        outline: 'border-border text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
