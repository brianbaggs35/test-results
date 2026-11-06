import { useEffect, useRef, useState } from 'react';
import { CheckIcon, ClipboardCopyIcon, CopyIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * A small clipboard button: one click copies `value`, and the icon turns into a tick for a moment. Used for branch names,
 * so checking one out is a paste away. `stopPropagation` keeps it from also opening the table row it sits in.
 */
export const CopyButton: React.FC<{ value: string; label: string; className?: string }> = ({ value, label, className }) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy — select the text and copy it manually.');
    }
  };

  return (
    <button
      type="button"
      onClick={(e) => void copy(e)}
      onKeyDown={(e) => e.stopPropagation()}
      aria-label={copied ? `${label} (copied)` : label}
      title={copied ? 'Copied' : label}
      data-copied={copied}
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
        copied && 'text-success hover:text-success',
        className,
      )}
    >
      {copied ? <CheckIcon className="size-3.5" /> : <ClipboardCopyIcon className="size-3.5" />}
    </button>
  );
};

/** A shell command to run by hand (never run by the app) with a copy button. */
export const CopyCommand: React.FC<{ command: string; label?: string }> = ({ command, label = 'Copy command' }) => {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      toast.success('Command copied.');
    } catch {
      toast.error('Could not copy — select the command and copy it manually.');
    }
  };
  return (
    <div className="flex items-start gap-2">
      <code className="min-w-0 flex-1 rounded-md border border-border/60 bg-muted px-2 py-1.5 text-xs break-all text-foreground">{command}</code>
      <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={label}>
        <CopyIcon />
        Copy
      </Button>
    </div>
  );
};
