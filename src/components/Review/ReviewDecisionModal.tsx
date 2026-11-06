import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangleIcon, CopyIcon, ExternalLinkIcon, LoaderIcon, MessageSquareWarningIcon, ShieldCheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { safeHref } from '@/utils/reviewFormat';
import { submitReviewDecision } from '@/utils/reviewApi';
import { clearDraft, readDraft, writeDraft } from '@/utils/reviewStorage';
import type { ReviewDecisionResult, ReviewDetail, ReviewIssue } from '@/types/review';

const MAX_REVIEW_INFO = 5000;
/** How long after the last keystroke the note being typed is saved in this browser. */
const DRAFT_SAVE_DELAY_MS = 400;

export interface ReviewDecisionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which button was pressed. 'declined' is the app's word for "request changes". */
  decision: 'approved' | 'declined';
  detail: ReviewDetail;
  ticket: ReviewIssue;
  /** Called once the decision is saved, with what the ticket now looks like and the note that was typed. */
  onDecided: (result: ReviewDecisionResult, text: string) => void;
}

/**
 * Approve or Request changes, like GitHub: a note, then one click. The decision is recorded for this exact commit and
 * added (never replacing anything) to the end of the ticket's description in Jira. Requesting changes needs a note
 * saying what to fix. What is typed is kept in this browser until it is saved, so closing the box by accident loses
 * nothing; if Jira can't take the note the decision still stands here and a way to add it by hand is offered.
 */
export const ReviewDecisionModal: React.FC<ReviewDecisionModalProps> = (props) => {
  // Mounted fresh each time it opens, so the note always starts from this commit's saved draft.
  return props.open ? <DecisionDialog {...props} /> : null;
};

const DecisionDialog: React.FC<ReviewDecisionModalProps> = ({ onOpenChange, decision, detail, ticket, onDecided }) => {
  const requesting = decision === 'declined';
  // a saved draft wins; otherwise start from the note this ticket already has (to adjust it)
  const [info, setInfo] = useState(() => readDraft(detail.branch, detail.sha, decision) || ticket.reviewInfo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Keep what is being typed (debounced), per PR commit and per button, so nothing typed is lost by closing the box.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edited = useRef(false);
  useEffect(() => {
    if (!edited.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => writeDraft(detail.branch, detail.sha, decision, info), DRAFT_SAVE_DELAY_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [info, detail.branch, detail.sha, decision]);

  const trimmed = info.trim();
  const tooLong = info.length > MAX_REVIEW_INFO;
  const missingNote = requesting && !trimmed;
  const invalid = tooLong || missingNote;
  const ticketUrl = safeHref(ticket.url);
  const shortSha = detail.sha.slice(0, 7);

  const close = (open: boolean) => {
    if (saving) return;
    // closing keeps the draft: write it now rather than waiting for the delay
    if (!open && edited.current) writeDraft(detail.branch, detail.sha, decision, info);
    onOpenChange(open);
  };

  const submit = async () => {
    setTouched(true);
    if (invalid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await submitReviewDecision({ branch: detail.branch, expectedSha: detail.sha, decision, info: trimmed || undefined });
      // saved: the draft has done its job. (Only now: a failed save keeps it.)
      if (saveTimer.current) clearTimeout(saveTimer.current);
      clearDraft(detail.branch, detail.sha, decision);
      toast.success(result.jiraRecorded ? `${ticket.key} ${requesting ? 'sent back for changes' : 'approved'} and noted on the ticket.` : `${ticket.key} ${requesting ? 'sent back for changes' : 'approved'}.`);
      onDecided(result, trimmed);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the review.');
      setSaving(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(trimmed);
      toast.success('Review text copied.');
    } catch {
      toast.error('Could not copy — select the text and copy it manually.');
    }
  };

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="max-w-xl" data-testid="decision-modal" onInteractOutside={(e) => saving && e.preventDefault()} onEscapeKeyDown={(e) => saving && e.preventDefault()}>
        <div className="flex items-start gap-3 pr-6">
          <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full', requesting ? 'bg-warning/15 text-warning' : 'bg-success/10 text-success')}>
            {requesting ? <MessageSquareWarningIcon className="size-5" /> : <ShieldCheckIcon className="size-5" />}
          </span>
          <div className="space-y-1">
            <DialogTitle>{requesting ? `Request changes on ${ticket.key}` : `Approve ${ticket.key}`}</DialogTitle>
            <DialogDescription>
              Recorded for commit <code className="rounded bg-muted px-1 text-xs">{shortSha}</code> and added, with your note, to the end of {ticket.key}&apos;s description in Jira. What is already
              there is never changed.
              {requesting ? ' A PR with changes requested can\'t be merged.' : ''}
            </DialogDescription>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="review-info">
              {requesting ? 'What needs to change' : 'Note'}
              {requesting ? <span className="text-destructive"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}
            </Label>
            <span className={cn('text-xs', tooLong ? 'text-destructive' : 'text-muted-foreground')} data-testid="review-info-count">
              {info.length.toLocaleString()} / {MAX_REVIEW_INFO.toLocaleString()}
            </span>
          </div>
          <Textarea
            id="review-info"
            value={info}
            onChange={(e) => {
              edited.current = true;
              setInfo(e.target.value);
            }}
            onBlur={() => setTouched(true)}
            rows={7}
            disabled={saving}
            autoFocus
            aria-invalid={touched && invalid}
            aria-describedby="review-info-help"
            placeholder={requesting ? 'What needs to change? e.g. the cleanup step is missing in afterAll; tag @critical…' : 'Anything worth noting for the author (optional)…'}
            className="resize-y"
          />
          <p id="review-info-help" className={cn('text-xs', touched && invalid ? 'text-destructive' : 'text-muted-foreground')} data-testid="review-info-help">
            {touched && missingNote
              ? 'Say what needs to change so the author knows what to fix.'
              : touched && tooLong
                ? `The note is limited to ${MAX_REVIEW_INFO.toLocaleString()} characters.`
                : 'Plain text. Line breaks are kept. What you type is kept in this browser until it is saved.'}
          </p>
        </div>

        {error && (
          <div role="alert" className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" data-testid="decision-error">
            <p className="flex items-start gap-2 font-medium break-words text-destructive">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
            <p className="text-muted-foreground">Your text is still here. You can retry, or add it to the ticket by hand:</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={copy} disabled={!trimmed}>
                <CopyIcon />
                Copy review text
              </Button>
              {ticketUrl && (
                <Button asChild variant="outline" size="sm">
                  <a href={ticketUrl} target="_blank" rel="noreferrer">
                    <ExternalLinkIcon />
                    Open {ticket.key} in Jira
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={saving || (touched && invalid)}
            aria-busy={saving}
            className={cn(requesting ? 'bg-warning text-warning-foreground hover:bg-warning/90' : 'bg-success text-success-foreground hover:bg-success/90')}
          >
            {saving ? <LoaderIcon className="animate-spin" /> : requesting ? <MessageSquareWarningIcon /> : <ShieldCheckIcon />}
            {saving ? 'Saving…' : requesting ? 'Request changes' : 'Approve'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
