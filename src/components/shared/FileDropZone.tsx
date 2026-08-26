import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { UploadIcon, FileIcon, AlertCircleIcon, LoaderIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  accept: string;
  isLoading?: boolean;
  error?: string | null;
  idleLabel: string;
  idleHint?: string;
  loadingLabel?: string;
  /** Button text, shown regardless of selection state (defaults per variant). */
  selectLabel?: string;
  selectedFileName?: string | null;
  variant?: 'default' | 'compact';
  className?: string;
  inputId?: string;
  'aria-label'?: string;
}

export function FileDropZone({
  onFileSelect,
  accept,
  isLoading = false,
  error = null,
  idleLabel,
  idleHint = 'Drag and drop or click to upload',
  loadingLabel = 'Processing your file...',
  selectLabel,
  selectedFileName = null,
  variant = 'default',
  className,
  inputId,
  'aria-label': ariaLabel,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (!isLoading) inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onFileSelect(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isLoading) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLoading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  };

  const compact = variant === 'compact';

  return (
    <div
      // Click-to-open is a mouse convenience; the file input below (and the explicit
      // button rendered further down) are the real, keyboard/AT-accessible controls,
      // so this wrapper deliberately isn't given interactive role/aria semantics of
      // its own to avoid double-announcing the same control to screen readers.
      onClick={openPicker}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 text-center transition-colors cursor-pointer',
        compact ? 'p-4' : 'p-8',
        isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50',
        error && 'border-destructive/40 bg-destructive/5',
        className
      )}
    >
      <input
        id={inputId}
        type="file"
        ref={inputRef}
        onChange={handleChange}
        accept={accept}
        className="hidden"
        aria-label={ariaLabel ?? idleLabel}
      />
      {isLoading ? (
        <div className={cn('flex flex-col items-center text-muted-foreground', compact ? 'gap-2' : 'gap-3')}>
          <LoaderIcon className={cn('animate-spin', compact ? 'size-6' : 'size-10')} />
          <p className={compact ? 'text-xs' : 'text-sm'}>{loadingLabel}</p>
        </div>
      ) : error ? (
        <div className={cn('flex flex-col items-center text-destructive', compact ? 'gap-2' : 'gap-3')}>
          <AlertCircleIcon className={compact ? 'size-6' : 'size-10'} />
          <p className={cn('text-center', compact ? 'text-xs' : 'text-sm')}>{error}</p>
          <Button
            size={compact ? 'sm' : 'default'}
            onClick={(e) => {
              e.stopPropagation();
              openPicker();
            }}
          >
            Try Again
          </Button>
        </div>
      ) : (
        <div className={cn('flex flex-col items-center', compact ? 'gap-1.5' : 'gap-2')}>
          {selectedFileName ? (
            <FileIcon className={cn('text-primary', compact ? 'size-6' : 'size-10')} />
          ) : (
            <UploadIcon className={cn('text-muted-foreground', compact ? 'size-6' : 'size-10')} />
          )}
          <p className={cn('font-medium text-foreground', compact ? 'text-sm' : 'text-lg')}>
            {selectedFileName ?? idleLabel}
          </p>
          {!compact && !selectedFileName && <p className="text-sm text-muted-foreground">{idleHint}</p>}
          <Button
            variant={compact ? 'outline' : 'default'}
            size={compact ? 'sm' : 'default'}
            className="mt-1"
            onClick={(e) => {
              e.stopPropagation();
              openPicker();
            }}
          >
            <UploadIcon className="size-4" />
            {selectLabel ?? (compact ? 'Click to choose a file' : 'Select File')}
          </Button>
        </div>
      )}
    </div>
  );
}
