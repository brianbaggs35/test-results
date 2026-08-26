import { MessageSquareIcon, XIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface FloatingBulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onMarkPending: () => void;
  onMarkInProgress: () => void;
  onMarkComplete: () => void;
  onBulkComment: () => void;
  onClearSelection: () => void;
}

export const FloatingBulkActionsBar: React.FC<FloatingBulkActionsBarProps> = ({
  selectedCount,
  totalCount,
  allSelected,
  onToggleSelectAll,
  onMarkPending,
  onMarkInProgress,
  onMarkComplete,
  onBulkComment,
  onClearSelection,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div
      data-testid="floating-bulk-actions-bar"
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm shadow-lg"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Label className="flex items-center gap-2 font-medium">
            <Checkbox
              data-testid="floating-select-all"
              checked={allSelected && totalCount > 0}
              onCheckedChange={onToggleSelectAll}
            />
            Select All
          </Label>
          <span className="text-sm font-semibold text-primary" data-testid="floating-selected-count">
            {selectedCount} selected
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground mr-1 hidden sm:inline">Bulk Actions:</span>
          <Button size="sm" variant="outline" onClick={onMarkPending} data-testid="floating-mark-pending" className="text-destructive hover:text-destructive">
            Mark as Pending
          </Button>
          <Button size="sm" variant="outline" onClick={onMarkInProgress} data-testid="floating-mark-in-progress" className="text-primary hover:text-primary">
            Mark as In Progress
          </Button>
          <Button size="sm" variant="outline" onClick={onMarkComplete} data-testid="floating-mark-complete" className="text-success hover:text-success">
            Mark as Complete
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <Button size="sm" variant="outline" onClick={onBulkComment} data-testid="floating-bulk-comment-btn">
            <MessageSquareIcon className="size-3.5" />
            Bulk Comment
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <Button size="sm" variant="ghost" onClick={onClearSelection} data-testid="floating-clear-selection">
            <XIcon className="size-3.5" />
            Clear Selection
          </Button>
        </div>
      </div>
    </div>
  );
};
