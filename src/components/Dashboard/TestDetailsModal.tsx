import { ClockIcon, FileTextIcon, CodeIcon, CopyIcon, CheckIcon, TerminalIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { TestCase } from '../../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { FloatingScrollbar } from '@/components/shared/FloatingScrollbar';

interface TestDetailsModalProps {
  test: TestCase;
  onClose: () => void;
}

export const TestDetailsModal = ({
  test,
  onClose
}: TestDetailsModalProps) => {
  const [copied, setCopied] = useState(false);
  const stackTraceRef = useRef<HTMLPreElement>(null);

  const formatStackTrace = (errorMessage: string) => {
    if (!errorMessage) return null;
    // Split message and stack trace if they exist
    const parts = errorMessage.split('\n');
    const message = parts[0];
    const stack = parts.slice(1).join('\n');
    return {
      message,
      stack: stack.trim()
    };
  };
  const formatFailureDetails = (details: NonNullable<TestCase['failureDetails']>) => {
    if (!details) return null;
    return {
      message: details.message || '',
      type: details.type || '',
      stackTrace: details.stackTrace || ''
    };
  };
  const error = test.errorMessage ? formatStackTrace(test.errorMessage) : null;
  const failureDetails = test.failureDetails ? formatFailureDetails(test.failureDetails) : null;
  const stackTraceText = failureDetails?.stackTrace || error?.stack || '';

  const handleCopyStackTrace = () => {
    navigator.clipboard?.writeText(stackTraceText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[95vw] lg:max-w-[min(92vw,1400px)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Test Name and Status */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              Test Name
            </h4>
            <p className="text-lg font-semibold text-foreground">{test.name}</p>
            <div className="mt-2">
              <StatusBadge status={test.status} />
            </div>
          </div>
          {/* Test Suite and Class Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-muted-foreground mb-1">
                Test Suite
              </h4>
              <div className="flex items-center min-w-0">
                <FileTextIcon className="size-4 text-primary mr-2 shrink-0" />
                <p className="text-foreground break-all">{test.suite}</p>
              </div>
            </div>
            {test.classname && <div className="min-w-0">
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  Class Name
                </h4>
                <div className="flex items-center min-w-0">
                  <CodeIcon className="size-4 text-purple-500 mr-2 shrink-0" />
                  <p className="text-foreground break-all">{test.classname}</p>
                </div>
              </div>}
          </div>
          {/* Execution Time */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              Execution Time
            </h4>
            <div className="flex items-center text-foreground">
              <ClockIcon className="size-4 text-primary mr-2" />
              <span>{test.time.toFixed(2)} seconds</span>
            </div>
          </div>
          {/* Error Details */}
          {(test.status === 'failed' || test.status === 'flaky') && <div className="space-y-4">
              {error && <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Error Summary
                  </h4>
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
                    <p className="text-destructive text-sm font-medium">
                      {error.message}
                    </p>
                  </div>
                </div>}
              {failureDetails && <>
                  {failureDetails.type && <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Failure Type
                      </h4>
                      <div className="bg-muted border rounded-md p-4">
                        <p className="text-foreground text-sm font-medium">
                          {failureDetails.type}
                        </p>
                      </div>
                    </div>}
                  {stackTraceText && <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Stack Trace
                    </h4>
                    <div className="rounded-lg overflow-hidden border border-zinc-800 shadow-inner">
                      {/* Terminal-style title bar */}
                      <div className="flex items-center justify-between bg-zinc-900 px-3 py-2 border-b border-zinc-800">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full bg-red-500/80" />
                            <span className="size-2.5 rounded-full bg-yellow-500/80" />
                            <span className="size-2.5 rounded-full bg-green-500/80" />
                          </div>
                          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <TerminalIcon className="size-3.5" />
                            stack-trace
                          </span>
                        </div>
                        {stackTraceText && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopyStackTrace}
                            className="h-6 px-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                          >
                            {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                            {copied ? 'Copied' : 'Copy'}
                          </Button>
                        )}
                      </div>
                      {/* Console body, with line numbers */}
                      <pre ref={stackTraceRef} className="p-4 text-sm min-w-0 overflow-x-auto bg-zinc-950">
                        <code className="font-mono block">
                          {stackTraceText.split('\n').map((line, i) => (
                            <div key={i} className="flex">
                              <span className="mr-4 w-6 shrink-0 select-none text-right text-zinc-600">
                                {i + 1}
                              </span>
                              <span className="whitespace-pre text-zinc-100">{line || ' '}</span>
                            </div>
                          ))}
                        </code>
                      </pre>
                      <FloatingScrollbar targetRef={stackTraceRef} />
                    </div>
                  </div>}
                </>}
            </div>}
        </div>
      </DialogContent>
    </Dialog>
  );
};
