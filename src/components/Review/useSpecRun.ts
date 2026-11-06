import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelSpecRun, fetchSpecJob, fetchTestServer, startSpecRun } from '@/utils/reviewApi';
import { isFinished } from '@/utils/specFormat';
import { clearActiveRun, readActiveRun, readRun, writeActiveRun, writeRun } from '@/utils/reviewStorage';
import type { SpecJob, TestServerStatus } from '@/types/review';

export type FileState = 'idle' | 'running' | 'passed' | 'failed' | 'skipped' | 'error' | 'cancelled';

export interface SpecRunState {
  job: SpecJob | null;
  /** All output received so far (the server sends it in increments). */
  output: string;
  starting: boolean;
  /** Problems starting a run or reaching the server (a run's own failure is in `job`). */
  error: string | null;
  fileStates: Record<string, FileState>;
  /** A run is starting or in progress. */
  running: boolean;
  /** The run shown was brought back from this browser's saved progress (or picked up again after leaving the page). */
  restored: boolean;
  start: (specs: string[] | 'all') => Promise<boolean>;
  cancel: () => Promise<void>;
  clearError: () => void;
}

const MAX_POLL_FAILURES = 5;

/**
 * Starts a spec run on the local dev server and follows it by polling. The run keeps going on the server even if this
 * page is left, so the run is remembered in this browser (per PR commit): coming back picks a still-running run up
 * again, or shows the finished results. If the server has lost the run (it was restarted) the saved results are
 * shown, and a run that never finished is marked as interrupted rather than left spinning.
 */
export function useSpecRun(branch: string, sha: string, allSpecs: string[], pollMs = 800): SpecRunState {
  const [job, setJob] = useState<SpecJob | null>(null);
  const [output, setOutput] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileStates, setFileStates] = useState<Record<string, FileState>>({});
  const [restored, setRestored] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jobId = useRef<string | null>(null);
  const offset = useRef(0);
  /** Everything received so far: the saved copy needs all of it, and state updates are asynchronous. */
  const outputRef = useRef('');
  const lastSavedStatus = useRef<string | null>(null);
  const failures = useRef(0);
  const mounted = useRef(true);
  const startingRef = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const applyFinal = useCallback((j: SpecJob) => {
    setFileStates((prev) => {
      const next = { ...prev };
      for (const file of j.specs) {
        const r = j.results?.find((x) => x.file === file);
        next[file] = r ? r.status : j.status === 'cancelled' ? 'cancelled' : j.status === 'error' ? 'error' : j.status === 'failed' ? 'failed' : 'idle';
      }
      return next;
    });
  }, []);

  /** Keeps the run in this browser: whenever its stage changes, and always when it finishes. */
  const persist = useCallback(
    (j: SpecJob) => {
      const finished = isFinished(j.status);
      if (!finished && lastSavedStatus.current === j.status) return;
      lastSavedStatus.current = j.status;
      writeRun(branch, sha, { ...j, output: outputRef.current });
      if (finished) clearActiveRun(branch, sha);
    },
    [branch, sha],
  );

  const poll = useCallback(
    async (id: string) => {
      if (!mounted.current || jobId.current !== id) return;
      try {
        const j = await fetchSpecJob(id, offset.current);
        if (!mounted.current || jobId.current !== id) return;
        failures.current = 0;
        offset.current = j.nextOffset;
        if (j.output) {
          outputRef.current += j.output;
          setOutput((o) => o + j.output);
        }
        setJob(j);
        persist(j);
        if (isFinished(j.status)) {
          applyFinal(j);
          return;
        }
      } catch (err) {
        failures.current++;
        if (failures.current >= MAX_POLL_FAILURES) {
          if (mounted.current) setError(err instanceof Error ? `Lost contact with the local server: ${err.message}` : 'Lost contact with the local server.');
          return;
        }
      }
      timer.current = setTimeout(() => void poll(id), pollMs);
    },
    [applyFinal, persist, pollMs],
  );

  // Coming back to this PR commit: pick up a run that is still going, or show the one that finished.
  useEffect(() => {
    let cancelled = false;
    const saved = readRun(branch, sha);
    const showSaved = () => {
      if (!saved) return;
      // A run that never finished (the page or the server went away) must not look like it is still going.
      const job: SpecJob = isFinished(saved.job.status)
        ? saved.job
        : { ...saved.job, status: 'error', error: 'This run was interrupted: the dev server was restarted or the run was lost. Run the specs again.' };
      outputRef.current = job.output;
      setOutput(job.output);
      setJob(job);
      applyFinal(job);
      setRestored(true);
    };
    const activeId = readActiveRun(branch, sha);
    if (!activeId) {
      showSaved();
      return;
    }
    fetchSpecJob(activeId, 0)
      .then((j) => {
        if (cancelled || !mounted.current) return;
        jobId.current = activeId;
        offset.current = j.nextOffset;
        outputRef.current = j.output;
        setOutput(j.output);
        setJob(j);
        setRestored(true);
        persist(j);
        if (isFinished(j.status)) applyFinal(j);
        else void poll(activeId);
      })
      .catch(() => {
        if (cancelled) return;
        clearActiveRun(branch, sha); // the server doesn't have it any more
        showSaved();
      });
    return () => {
      cancelled = true;
    };
    // restoring happens once per PR commit; the callbacks are stable for it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, sha]);

  const start = useCallback(
    async (specs: string[] | 'all'): Promise<boolean> => {
      if (startingRef.current) return false; // a second click can never start a second run
      startingRef.current = true;
      setStarting(true);
      setError(null);
      try {
        const { id } = await startSpecRun({ branch, expectedSha: sha, specs });
        if (!mounted.current) return true;
        const files = specs === 'all' ? allSpecs : specs;
        jobId.current = id;
        offset.current = 0;
        failures.current = 0;
        outputRef.current = '';
        lastSavedStatus.current = null;
        writeActiveRun(branch, sha, id);
        setRestored(false);
        setOutput('');
        setJob(null);
        setFileStates((prev) => ({ ...prev, ...Object.fromEntries(files.map((f) => [f, 'running' as const])) }));
        void poll(id);
        return true;
      } catch (err) {
        if (mounted.current) setError(err instanceof Error ? err.message : 'Could not start the specs.');
        return false;
      } finally {
        startingRef.current = false;
        if (mounted.current) setStarting(false);
      }
    },
    [allSpecs, branch, poll, sha],
  );

  const cancel = useCallback(async () => {
    const id = jobId.current;
    if (!id) return;
    try {
      const j = await cancelSpecRun(id);
      if (mounted.current && jobId.current === id) setJob(j);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Could not cancel the run.');
    }
  }, []);

  const running = starting || (job !== null && !isFinished(job.status)) || (jobId.current !== null && job === null && !error);

  return { job, output, starting, error, fileStates, running, restored, start, cancel, clearError: () => setError(null) };
}

export interface TestServerState {
  status: TestServerStatus | null;
  checking: boolean;
  error: string | null;
  up: boolean;
  recheck: () => Promise<void>;
}

/** Is the local test server (port 5017) up? Checked on mount, on demand, and every `pollMs`. Does nothing when not `enabled`. */
export function useTestServer(pollMs = 8000, enabled = true): TestServerState {
  const [status, setStatus] = useState<TestServerStatus | null>(null);
  const [checking, setChecking] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const check = useCallback(async () => {
    try {
      const s = await fetchTestServer();
      if (!mounted.current) return;
      setStatus(s);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setStatus(null);
      setError(err instanceof Error ? err.message : 'Could not check the test server.');
    } finally {
      if (mounted.current) setChecking(false);
    }
  }, []);

  const recheck = useCallback(async () => {
    setChecking(true);
    await check();
  }, [check]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) return;
    // `check` only sets state after awaiting the network, never synchronously.
    void check();
    const interval = pollMs > 0 ? setInterval(() => void check(), pollMs) : null;
    return () => {
      mounted.current = false;
      if (interval) clearInterval(interval);
    };
  }, [check, pollMs, enabled]);

  return { status, checking, error, up: !!status?.up, recheck };
}
