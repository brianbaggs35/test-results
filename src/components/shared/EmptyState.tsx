import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  variant?: 'default' | 'success';
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, variant = 'default', className }: EmptyStateProps) {
  const isSuccess = variant === 'success';
  return (
    <Card
      className={cn(
        isSuccess && 'border-success/30 bg-success/5',
        className
      )}
    >
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div
          className={cn(
            'flex size-14 items-center justify-center rounded-full',
            isSuccess ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="size-7" />
        </div>
        <h2 className={cn('text-xl font-semibold', isSuccess ? 'text-success' : 'text-foreground')}>{title}</h2>
        <p className={cn('max-w-md text-sm', isSuccess ? 'text-success/90' : 'text-muted-foreground')}>
          {description}
        </p>
        {action}
      </CardContent>
    </Card>
  );
}
