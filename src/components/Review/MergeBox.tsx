import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangleIcon, CheckCircleIcon, CopyIcon, ExternalLinkIcon, FlaskConicalIcon, GitMergeIcon, LoaderIcon, MessageSquareWarningIcon, RefreshCwIcon, ShieldCheckIcon, Undo2Icon, XCircleIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { plural, safeHref, shellQuote } from '@/utils/reviewFormat';
import { ReviewApiError, mergeReview } from '@/utils/reviewApi';
import { clearBranchData, readMoveToDone, writeMoveToDone } from '@/utils/reviewStorage';
import { CopyButton, CopyCommand } from './CopyCommand';
import { ErrorBanner } from './Feedback';
import type { ReviewDetail, ReviewIssue, SpecGate } from '@/types/review';

/** A decision that is in this app but could not be written into the ticket's description. */
export interface JiraNote {
  /** Why Jira could not take it. */
  note: string;
  /** The text to paste into the ticket by hand. */
  text: string;
}

export interface MergeBoxProps {
  detail: ReviewDetail;
  /** The ticket with the decision that applies to this commit (from this app, the description, or Jira's own checkboxes). */
  ticket: ReviewIssue;
  /** Whether approving is allowed yet: every spec of this PR has to have passed for this exact commit. */
  gate: SpecGate;
  /** Opens the Specs tab. */
  onGoToSpecs: () => void;
  /** Set when the last decision could not be written into the Jira description. */
  jiraNote: JiraNote | null;
  onDecide: (decision: 'approved' | 'declined') => void;
  /** Withdraw the decision again. */
  onClear: () => void;
  clearing: boolean;
  /** Specs are running: merging waits. */
  specsRunning: boolean;
  onMerged: () => void;
  onReload: () => void;
  onBusyChange: (busy: boolean) => void;
}

export const MergeBox = React.forwardRef<HTMLDivElement, MergeBoxProps>(({ detail, ticket, gate, onGoToSpecs, jiraNote, onDecide, onClear, clearing, specsRunning, onMerged, onReload, onBusyChange }, ref) => {
  const approved = ticket.approval === 'approved';
  const declined = ticket.approval === 'declined';
  const [moveToDone, setMoveToDone] = useState(readMoveToDone);
  const [confirming, setConfirming] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<{ message: string; files: string[] } | null>(null);
  // State updates are async, so a rapid second click (or one during the
  // dialog's closing animation) could otherwise start a second merge. A ref
  // flips synchronously, making "merge once" a hard guarantee.
  const inFlight = useRef(false);

  const alreadyMerged = detail.unmerged === 0;
  const hasMergeCommits = detail.mergeCommits > 0;
  const blocked = alreadyMerged || detail.canRebase === false || hasMergeCommits;
  const canMerge = !blocked && approved && !specsRunning;

  // If merging stops being allowed (approval undone, declined, specs started…), the pending confirmation goes away.
  useEffect(() => {
    if (!canMerge) setConfirming(false);
  }, [canMerge]);

  useEffect(() => {
    if (!merging) return;
    onBusyChange(true);
    // Leaving mid-merge would hide the outcome; make the browser ask first.
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      onBusyChange(false);
    };
  }, [merging, onBusyChange]);

  const doMerge = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setConfirming(false);
    setMerging(true);
    setError(null);
    try {
      const result = await mergeReview({ branch: detail.branch, expectedSha: detail.sha, moveToDone, approved: true });
      toast.success(`${ticket.key}: ${plural(result.merged, 'commit')} rebased and merged into ${result.baseBranch}.`);
      if (result.branchDeleted) toast.success(`Branch ${detail.branch} deleted.`);
      if (result.ticketMoved) toast.success(`${result.ticketMoved} moved to Done in Jira.`);
      if (result.warning) toast.warning(result.warning, { duration: 12000 });
      // The merge succeeded: only now is what was saved in this browser for the PR (viewed files, spec results, notes) let go.
      // A failed merge never gets here, so everything is still there to retry with.
      clearBranchData(detail.branch);
      // Stays locked: the page navigates away, so there is no second chance to click.
      onMerged();
    } catch (err) {
      const e = err instanceof ReviewApiError ? err : new ReviewApiError(err instanceof Error ? err.message : 'Merge failed.');
      setError({ message: e.message, files: e.details });
      inFlight.current = false;
      setMerging(false);
    }
  };

  const base = detail.baseBranch;
  let tone: 'ok' | 'bad' | 'warn';
  let headline: string;
  let sub: string | null = null;
  if (alreadyMerged) {
    tone = 'warn';
    headline = `Nothing to merge — ${base} already has these changes.`;
  } else if (hasMergeCommits) {
    tone = 'bad';
    headline = `This branch contains ${plural(detail.mergeCommits, 'merge commit')}.`;
    sub = `Someone merged ${base} or another branch into it. A rebase would flatten ${detail.mergeCommits === 1 ? 'it' : 'them'} and could silently drop what only ${detail.mergeCommits === 1 ? 'it contains' : 'they contain'}, and merge commits are never wanted here.`;
  } else if (detail.canRebase === false) {
    tone = 'bad';
    headline = `This branch has conflicts with ${base} that must be resolved.`;
  } else if (detail.canRebase === null) {
    tone = 'warn';
    headline = `Couldn't pre-check conflicts with ${base}.`;
    sub = 'Merging will still try, and stop without changing anything if the rebase conflicts.';
  } else {
    tone = 'ok';
    headline = `No conflicts with ${base}. Ready to rebase and merge.`;
    sub =
      detail.behind > 0
        ? `${base} has ${plural(detail.behind, 'newer commit')} — your ${plural(detail.unmerged, 'commit')} will be rebased on top automatically, no manual rebase needed.`
        : null;
  }

  const description =
    `This rebases ${plural(detail.unmerged, 'commit')} from ${detail.branch} onto the latest ${base}, pushes the result to origin/${base}, ` +
    `and then deletes the branch ${detail.branch} from origin. ` +
    (moveToDone ? `${ticket.key} will then be moved to Done in Jira. ` : '') +
    'This updates the shared repository and cannot be undone from here.';

  return (
    <Card
      ref={ref}
      id="merge-box"
      data-testid="merge-box"
      className={cn('scroll-mt-24', tone === 'ok' && 'border-success/40', tone === 'bad' && 'border-destructive/40', tone === 'warn' && 'border-warning/40')}
    >
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start gap-3" aria-live="polite">
          {tone === 'ok' ? (
            <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-success" />
          ) : tone === 'bad' ? (
            <XCircleIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
          ) : (
            <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-warning" />
          )}
          <div className="min-w-0 space-y-1">
            <p className="font-semibold">{headline}</p>
            {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
            {detail.conflicts.length > 0 && (
              <ul className="list-disc pl-5 font-mono text-xs break-all text-destructive" data-testid="conflict-files">
                {detail.conflicts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {hasMergeCommits && (
          <div className="space-y-1.5 text-sm text-muted-foreground" data-testid="merge-commit-help">
            <p>Remove them by rebasing the branch yourself, then push it and refresh this page:</p>
            <CopyCommand command={`git fetch ${shellQuote('origin')} && git checkout ${shellQuote(detail.branch)} && git rebase ${shellQuote(`origin/${base}`)} && git push --force-with-lease ${shellQuote('origin')} ${shellQuote(detail.branch)}`} label="Copy rebase and push commands" />
          </div>
        )}

        {detail.canRebase === false && !hasMergeCommits && (
          <div className="space-y-1.5 text-sm text-muted-foreground" data-testid="conflict-help">
            <p>Fix it locally (resolve the files above, finish the rebase, then push), and refresh this page:</p>
            <CopyCommand command={`git fetch origin && git checkout ${detail.branch} && git rebase origin/${base}`} label="Copy rebase command" />
          </div>
        )}

        {!alreadyMerged && (
          <div
            className={cn(
              'space-y-3 rounded-lg border p-3',
              approved && 'border-success/40 bg-success/5',
              declined && 'border-warning/50 bg-warning/5',
              !approved && !declined && 'border-border/60 bg-muted/30',
            )}
            data-testid="approval"
            data-state={ticket.approval ?? 'none'}
            data-source={ticket.approvalSource ?? 'none'}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className={cn('flex items-center gap-2 text-sm font-medium', approved && 'text-success', declined && 'text-warning-foreground dark:text-warning', !approved && !declined && 'font-normal text-muted-foreground')}>
                {approved ? <ShieldCheckIcon className="size-4 shrink-0" /> : declined ? <MessageSquareWarningIcon className="size-4 shrink-0" /> : null}
                <span data-testid="approval-text">
                  {approved
                    ? `Approved for this commit${ticket.approvalSource === 'field' ? ' (Approved is ticked in Jira).' : '.'}`
                    : declined
                      ? 'Changes requested. Merging is blocked until it is approved.'
                      : ticket.staleDecision
                        ? `${ticket.staleDecision.decision === 'approved' ? 'Approved' : 'Changes were requested'} for an earlier commit (${ticket.staleDecision.sha.slice(0, 7)}). This branch has changed since, so it needs a new decision.`
                        : 'Read through the changes, then approve or request changes. Approving unlocks Rebase and merge.'}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {!approved && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={merging || clearing || !gate.satisfied}
                    title={gate.satisfied ? undefined : 'Every spec in this PR has to pass first'}
                    onClick={() => onDecide('approved')}
                  >
                    <ShieldCheckIcon />
                    {declined ? 'Approve instead…' : 'Approve…'}
                  </Button>
                )}
                {!declined && (
                  <Button type="button" variant="outline" size="sm" disabled={merging || clearing} onClick={() => onDecide('declined')} className="text-warning-foreground dark:text-warning">
                    <MessageSquareWarningIcon />
                    Request changes…
                  </Button>
                )}
                {(approved || declined) && ticket.approvalSource !== 'field' && (
                  <Button type="button" variant="ghost" size="sm" disabled={merging || clearing} onClick={onClear}>
                    {clearing ? <LoaderIcon className="animate-spin" /> : <Undo2Icon />}
                    {clearing ? 'Withdrawing…' : approved ? 'Withdraw approval' : 'Withdraw request'}
                  </Button>
                )}
              </div>
            </div>

            {!approved && !gate.satisfied && (
              <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between" data-testid="approval-gate">
                <p className="flex items-start gap-2 text-sm">
                  <FlaskConicalIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>
                    Every spec in this PR has to pass before it can be approved:{' '}
                    <strong data-testid="approval-gate-count">
                      {gate.required.filter((f) => gate.progress.some((p) => p.file === f && p.status !== 'failed')).length} of {gate.required.length}
                    </strong>{' '}
                    have passed for this commit
                    {gate.progress.some((p) => p.status === 'failed') ? ` (${gate.progress.filter((p) => p.status === 'failed').length} failed)` : ''}.
                  </span>
                </p>
                <Button type="button" size="sm" variant="outline" onClick={onGoToSpecs} className="shrink-0">
                  <FlaskConicalIcon />
                  Go to the specs
                </Button>
              </div>
            )}

            {ticket.reviewInfo && (
              <div className="rounded-md bg-background/70 p-3" data-testid="review-info">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">{declined ? 'Changes requested' : 'Review note'}</p>
                <p className="text-sm break-words whitespace-pre-wrap">{ticket.reviewInfo}</p>
              </div>
            )}

            {jiraNote && (
              <div className="space-y-2 rounded-md border border-warning/50 bg-warning/5 p-3 text-sm" role="status" data-testid="jira-note">
                <p className="flex items-start gap-2">
                  <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-warning" />
                  <span>
                    Saved in this app, but it could not be added to {ticket.key}&apos;s description in Jira: {jiraNote.note}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {jiraNote.text && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(jiraNote.text).then(
                          () => toast.success('Review text copied.'),
                          () => toast.error('Could not copy — select the text and copy it manually.'),
                        );
                      }}
                    >
                      <CopyIcon />
                      Copy the note
                    </Button>
                  )}
                  {safeHref(ticket.url) && (
                    <Button asChild size="sm" variant="outline">
                      <a href={safeHref(ticket.url)} target="_blank" rel="noreferrer">
                        <ExternalLinkIcon />
                        Open {ticket.key} in Jira
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!blocked && (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Merging also deletes the branch <code className="rounded bg-muted px-1 text-xs">{detail.branch}</code>
              <CopyButton value={detail.branch} label={`Copy branch name ${detail.branch}`} className="ml-1 align-middle" /> from origin.
            </p>
            <div className="flex items-center gap-2">
              <Checkbox id="move-to-done" checked={moveToDone} disabled={merging} onCheckedChange={(v) => {
                  setMoveToDone(v === true);
                  writeMoveToDone(v === true);
                }} />
              <Label htmlFor="move-to-done" className="text-sm font-normal">
                Move {ticket.key} to Done in Jira after merging
              </Label>
            </div>
          </div>
        )}

        {error && (
          <ErrorBanner
            testId="merge-error"
            actions={
              <Button type="button" variant="outline" size="sm" onClick={onReload} className="text-foreground">
                <RefreshCwIcon />
                Reload latest changes
              </Button>
            }
          >
            {error.message}
            {error.files.length > 0 && (
              <ul className="mt-1 list-disc pl-5 font-mono text-xs font-normal break-all">
                {error.files.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
          </ErrorBanner>
        )}

        {confirming && !merging && canMerge ? (
          // Like GitHub: the first click only asks; nothing is sent until the second.
          <div
            role="group"
            aria-label="Confirm rebase and merge"
            data-testid="merge-confirm"
            className="space-y-3 rounded-lg border border-success/40 bg-success/5 p-3"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setConfirming(false);
            }}
          >
            <p className="text-sm" data-testid="merge-confirm-text">
              {description}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                size="lg"
                autoFocus
                // The merge needs two deliberate actions. Two accidents are ruled out here:
                // - holding Enter on "Rebase and merge": its key repeat would otherwise land on this button, which
                //   appears focused, and confirm for you. Only a fresh key press counts.
                // - the second click of a double-click.
                onKeyDown={(e) => {
                  if (e.repeat) e.preventDefault();
                }}
                onClick={(e) => {
                  if (e.detail > 1) return;
                  void doMerge();
                }}
                className="w-full bg-success text-success-foreground hover:bg-success/90 sm:w-auto"
              >
                <GitMergeIcon className="size-5" />
                Confirm rebase and merge
              </Button>
              <Button size="lg" variant="outline" onClick={() => setConfirming(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="lg"
            disabled={!canMerge || merging}
            aria-busy={merging}
            onClick={() => setConfirming(true)}
            className="w-full bg-success text-success-foreground hover:bg-success/90 sm:w-auto"
          >
            {merging ? <LoaderIcon className="size-5 animate-spin" /> : <GitMergeIcon className="size-5" />}
            {merging ? 'Rebasing and merging…' : 'Rebase and merge'}
          </Button>
        )}
        {!blocked && !approved && !merging && <p className="text-xs text-muted-foreground">{declined ? 'Changes were requested. Approve it above once they have been addressed to enable this button.' : 'Approve the changes above to enable this button.'}</p>}
        {!blocked && approved && specsRunning && !merging && <p className="text-xs text-muted-foreground">Specs are running. Merging is available when they finish (or are cancelled).</p>}
        {merging && (
          <p role="status" className="text-sm text-muted-foreground">
            Rebasing onto {base} and pushing — this can take a few seconds. Please don't close this tab.
          </p>
        )}
      </CardContent>
    </Card>
  );
});
MergeBox.displayName = 'MergeBox';
