import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  AlertTriangleIcon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type Status = 'passed' | 'failed' | 'skipped' | 'flaky' | 'pending' | 'in_progress' | 'completed';

const STATUS_CONFIG: Record<Status, { label: string; icon: LucideIcon; className: string }> = {
  passed: {
    label: 'Passed',
    icon: CheckCircleIcon,
    className: 'bg-success/10 text-success border-success/20',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircleIcon,
    className: 'bg-success/10 text-success border-success/20',
  },
  failed: {
    label: 'Failed',
    icon: XCircleIcon,
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  pending: {
    label: 'Pending',
    icon: XCircleIcon,
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  skipped: {
    label: 'Skipped',
    icon: AlertTriangleIcon,
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  flaky: {
    label: 'Flaky',
    icon: AlertTriangleIcon,
    className: 'bg-flaky/10 text-flaky border-flaky/20',
  },
  in_progress: {
    label: 'In Progress',
    icon: ClockIcon,
    className: 'bg-primary/10 text-primary border-primary/20',
  },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
  iconClassName?: string;
  /** Renders icon-only, label available to assistive tech via sr-only text. */
  compact?: boolean;
}

export function StatusBadge({ status, className, iconClassName, compact }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      // aria-label (not visible/sr-only text) in compact mode, so this doesn't collide
      // with unrelated exact-text queries elsewhere on the page (e.g. a filter's "Pending" option).
      aria-label={compact ? config.label : undefined}
      // "status-badge" is a stable, non-color hook for e2e selectors to scope onto
      // (e.g. `.status-badge.text-primary`), since the color utility classes alone
      // are also used elsewhere on these pages for unrelated elements.
      className={cn(
        'status-badge inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        config.className,
        className
      )}
    >
      <Icon className={cn('size-3.5', iconClassName)} aria-hidden="true" />
      {!compact && config.label}
    </span>
  );
}
