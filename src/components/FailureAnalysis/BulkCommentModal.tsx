import { useState } from 'react';
import { MessageSquareIcon } from 'lucide-react';
import type { FailureProgressItem } from '../../types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type StatusValue = 'pending' | 'in_progress' | 'completed';

export interface BulkCommentResult {
  comments: Record<string, string>;
  assignee?: string;
  status?: StatusValue;
  individualAssignees?: Record<string, string>;
  individualStatuses?: Record<string, StatusValue>;
}

interface BulkCommentModalProps {
  selectedItems: FailureProgressItem[];
  onApply: (result: BulkCommentResult) => void;
  onClose: () => void;
}

type CommentMode = 'same' | 'individual';

/** Replace whitespace with underscores to produce a valid HTML id/name value. */
const sanitizeId = (id: string) => id.replace(/\s+/g, '_');

const selectClassName =
  'w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export const BulkCommentModal = ({
  selectedItems,
  onApply,
  onClose,
}: BulkCommentModalProps) => {
  const [mode, setMode] = useState<CommentMode>('same');
  const [sharedComment, setSharedComment] = useState('');
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [bulkStatus, setBulkStatus] = useState<StatusValue | ''>('');
  const [individualComments, setIndividualComments] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      selectedItems.forEach((item) => {
        initial[item.id] = item.notes || '';
      });
      return initial;
    },
  );
  const [individualAssignees, setIndividualAssignees] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      selectedItems.forEach((item) => {
        initial[item.id] = item.assignee || '';
      });
      return initial;
    },
  );
  const [individualStatuses, setIndividualStatuses] = useState<Record<string, StatusValue | ''>>(
    () => {
      const initial: Record<string, StatusValue | ''> = {};
      selectedItems.forEach((item) => {
        initial[item.id] = '';
      });
      return initial;
    },
  );

  const handleApply = () => {
    const comments: Record<string, string> = {};
    if (mode === 'same') {
      const trimmed = sharedComment.trim();
      selectedItems.forEach((item) => {
        comments[item.id] = trimmed;
      });
    } else {
      selectedItems.forEach((item) => {
        comments[item.id] = (individualComments[item.id] || '').trim();
      });
    }
    const result: BulkCommentResult = { comments };
    if (mode === 'same') {
      if (bulkAssignee.trim()) {
        result.assignee = bulkAssignee.trim();
      }
      if (bulkStatus) {
        result.status = bulkStatus;
      }
    } else {
      // Individual mode: collect per-item assignees and statuses
      const assignees: Record<string, string> = {};
      const statuses: Record<string, StatusValue> = {};
      let hasAssignees = false;
      let hasStatuses = false;
      selectedItems.forEach((item) => {
        const assignee = individualAssignees[item.id]?.trim();
        if (assignee) {
          assignees[item.id] = assignee;
          hasAssignees = true;
        }
        const status = individualStatuses[item.id];
        if (status) {
          statuses[item.id] = status;
          hasStatuses = true;
        }
      });
      if (hasAssignees) {
        result.individualAssignees = assignees;
      }
      if (hasStatuses) {
        result.individualStatuses = statuses;
      }
    }
    onApply(result);
  };

  const updateIndividualComment = (id: string, value: string) => {
    setIndividualComments((prev) => ({ ...prev, [id]: value }));
  };

  const updateIndividualAssignee = (id: string, value: string) => {
    setIndividualAssignees((prev) => ({ ...prev, [id]: value }));
  };

  const updateIndividualStatus = (id: string, value: StatusValue | '') => {
    setIndividualStatuses((prev) => ({ ...prev, [id]: value }));
  };

  const hasContent =
    mode === 'same'
      ? sharedComment.trim().length > 0 || bulkAssignee.trim().length > 0 || bulkStatus !== ''
      : Object.values(individualComments).some((c) => c.trim().length > 0) ||
        Object.values(individualAssignees).some((a) => a.trim().length > 0) ||
        Object.values(individualStatuses).some((s) => s !== '');

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        data-testid="bulk-comment-modal"
        className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0"
      >
        {/* Header */}
        <DialogHeader className="flex-row items-center justify-between gap-3 p-5 border-b space-y-0">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <MessageSquareIcon className="w-5 h-5 text-primary" />
            Bulk Comment ({selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''})
          </DialogTitle>
        </DialogHeader>

        {/* Status and Assignee - shown only in "same" mode */}
        {mode === 'same' && (
          <div className="px-5 pt-4 pb-2 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bulk-status">Status</Label>
                <select
                  id="bulk-status"
                  name="bulkStatus"
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as StatusValue | '')}
                  className={cn(selectClassName, 'text-sm')}
                  data-testid="bulk-status-select"
                >
                  <option value="">No Change</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bulk-assignee">Assignee</Label>
                <Input
                  id="bulk-assignee"
                  name="bulkAssignee"
                  type="text"
                  value={bulkAssignee}
                  onChange={(e) => setBulkAssignee(e.target.value)}
                  placeholder="Who is working on this?"
                  data-testid="bulk-assignee-input"
                />
              </div>
            </div>
          </div>
        )}

        {/* Mode Selector */}
        <div className="px-5 pt-2 pb-2">
          <div className="flex rounded-lg bg-muted p-1">
            <button
              onClick={() => setMode('same')}
              className={cn(
                'flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors',
                mode === 'same' ? 'bg-background text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
              data-testid="mode-same"
            >
              Same Comment for All
            </button>
            <button
              onClick={() => setMode('individual')}
              className={cn(
                'flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors',
                mode === 'individual' ? 'bg-background text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
              data-testid="mode-individual"
            >
              Individual Comments
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {mode === 'same' ? (
            <div>
              <Label htmlFor="shared-comment" className="mb-2">
                Comment for all selected items
              </Label>
              <Textarea
                id="shared-comment"
                name="sharedComment"
                value={sharedComment}
                onChange={(e) => setSharedComment(e.target.value)}
                placeholder="Enter a comment to apply to all selected failures..."
                className="resize-none"
                rows={4}
                data-testid="shared-comment-input"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                This comment will be applied to all {selectedItems.length} selected item
                {selectedItems.length !== 1 ? 's' : ''}.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedItems.map((item) => {
                const safeId = sanitizeId(item.id);
                return (
                <div
                  key={item.id}
                  className="border rounded-lg p-3"
                  data-testid={`individual-item-${item.id}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={cn(
                        'inline-block w-2 h-2 rounded-full',
                        item.status === 'completed'
                          ? 'bg-success'
                          : item.status === 'in_progress'
                            ? 'bg-primary'
                            : item.status === 'pending' && item.testStatus === 'flaky'
                              ? 'bg-flaky'
                              : 'bg-destructive'
                      )}
                    />
                    <span className="text-sm font-medium text-foreground truncate">
                      {item.name}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">— {item.suite}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="space-y-1">
                      <Label htmlFor={`individual-status-${safeId}`} className="text-xs font-medium text-muted-foreground">
                        Status
                      </Label>
                      <select
                        id={`individual-status-${safeId}`}
                        name={`individualStatus-${safeId}`}
                        value={individualStatuses[item.id] || ''}
                        onChange={(e) => updateIndividualStatus(item.id, e.target.value as StatusValue | '')}
                        className={cn(selectClassName, 'h-8 text-xs')}
                        data-testid={`individual-status-${item.id}`}
                      >
                        <option value="">No Change</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`individual-assignee-${safeId}`} className="text-xs font-medium text-muted-foreground">
                        Assignee
                      </Label>
                      <Input
                        id={`individual-assignee-${safeId}`}
                        name={`individualAssignee-${safeId}`}
                        type="text"
                        value={individualAssignees[item.id] || ''}
                        onChange={(e) => updateIndividualAssignee(item.id, e.target.value)}
                        placeholder="Assignee..."
                        className="h-8 text-xs"
                        data-testid={`individual-assignee-${item.id}`}
                      />
                    </div>
                  </div>
                  <Label htmlFor={`individual-comment-input-${safeId}`} className="text-xs font-medium text-muted-foreground">
                    Notes
                  </Label>
                  <Textarea
                    id={`individual-comment-input-${safeId}`}
                    name={`individualComment-${safeId}`}
                    value={individualComments[item.id] || ''}
                    onChange={(e) => updateIndividualComment(item.id, e.target.value)}
                    placeholder="Enter comment for this test..."
                    className="mt-1 text-sm resize-none"
                    rows={2}
                    data-testid={`individual-comment-${item.id}`}
                  />
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-5 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!hasContent} data-testid="apply-comments-btn">
            Apply Comments
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
