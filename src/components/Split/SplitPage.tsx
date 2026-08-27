import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  SplitIcon,
  MergeIcon,
  UploadIcon,
  DownloadIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from 'lucide-react';
import type { TestData, ExportBundle } from '../../types';
import { splitJUnitXml, type SplitResult } from '../../utils/splitJUnitXml';
import { combineExportBundles } from '../../utils/combineResults';
import { readExportBundle } from '../../utils/exportBundle';
import { computeStructureHash } from '../../utils/structureHash';
import { downloadFile, readFileAsText } from '../../utils/download';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileDropZone } from '@/components/shared/FileDropZone';

interface SplitPageProps {
  xmlContent: string | null;
  onCombined: (data: TestData) => void;
  setActiveTab: (tab: string) => void;
}

export const SplitPage: React.FC<SplitPageProps> = ({ xmlContent, onCombined, setActiveTab }) => {
  // ── Split section ──────────────────────────────────────────────────
  const [sourceXml, setSourceXml] = useState<string | null>(xmlContent);
  const [sourceName, setSourceName] = useState<string | null>(xmlContent ? 'currently loaded file' : null);
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [isDraggingSource, setIsDraggingSource] = useState(false);
  const splitInputRef = useRef<HTMLInputElement>(null);

  const loadSourceFile = async (file: File) => {
    setSplitError(null);
    setSplitResult(null);
    try {
      const text = await readFileAsText(file);
      setSourceXml(text);
      setSourceName(file.name);
    } catch {
      setSplitError(`Could not read "${file.name}".`);
    }
  };

  const handleSplitFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await loadSourceFile(file);
  };

  const handleSourceDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingSource(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await loadSourceFile(file);
  };

  const handleSplit = () => {
    if (!sourceXml) return;
    setSplitError(null);
    try {
      setSplitResult(splitJUnitXml(sourceXml));
    } catch (err) {
      setSplitResult(null);
      setSplitError(err instanceof Error ? err.message : 'Failed to split this file.');
    }
  };

  // ── Combine section ────────────────────────────────────────────────
  const [bundleAFile, setBundleAFile] = useState<File | null>(null);
  const [bundleBFile, setBundleBFile] = useState<File | null>(null);
  const [combineError, setCombineError] = useState<string | null>(null);
  const [combineWarnings, setCombineWarnings] = useState<string[]>([]);
  const [combinedData, setCombinedData] = useState<TestData | null>(null);

  const handleCombine = async () => {
    if (!bundleAFile || !bundleBFile) return;
    setCombineError(null);
    setCombineWarnings([]);
    setCombinedData(null);
    try {
      const [a, b] = await Promise.all([
        readExportBundle(bundleAFile) as Promise<ExportBundle>,
        readExportBundle(bundleBFile) as Promise<ExportBundle>,
      ]);
      const result = combineExportBundles(a, b);
      localStorage.setItem('testFixProgress', JSON.stringify(result.progress));
      const hash = await computeStructureHash(result.testData);
      if (hash) localStorage.setItem('testFixProgress_structureHash', hash);
      setCombinedData(result.testData);
      setCombineWarnings(result.warnings);
      onCombined(result.testData);
    } catch (err) {
      setCombineError(err instanceof Error ? err.message : 'Failed to combine these files.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Split section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <SplitIcon className="size-6 text-primary" />
            Split a report for your team
          </CardTitle>
          <p className="text-muted-foreground pt-1">
            Divides the failed/errored tests across two new JUnit XML files, keeping every test suite's
            failures together in just one of the two — so two people working from file A and file B never
            end up editing tests in the same suite. Every passed and skipped test stays in both. The split
            is deterministic: running it on the same file produces the same two files no matter who runs
            it or on which machine, though the two halves won't always come out perfectly even.
          </p>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDraggingSource(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDraggingSource(false); }}
            onDrop={handleSourceDrop}
            className={cn(
              'flex flex-wrap items-center gap-3 mb-4 rounded-lg border-2 border-dashed p-4 transition-colors',
              isDraggingSource ? 'border-primary bg-primary/5' : 'border-border'
            )}
          >
            <input
              id="split-file-upload"
              name="splitFileUpload"
              type="file"
              ref={splitInputRef}
              onChange={handleSplitFileChange}
              accept=".xml"
              className="hidden"
              aria-label="Upload XML file to split"
            />
            <Button variant="outline" onClick={() => splitInputRef.current?.click()}>
              <UploadIcon className="size-4" />
              Choose XML File
            </Button>
            {sourceName && <span className="text-sm text-muted-foreground">Using: {sourceName}</span>}
            <span className="text-sm text-muted-foreground hidden sm:inline">or drag a file here</span>
            <Button onClick={handleSplit} disabled={!sourceXml} className="ml-auto">
              <SplitIcon className="size-4" />
              Split
            </Button>
          </div>

          {splitError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircleIcon className="size-4" />
              <AlertDescription>{splitError}</AlertDescription>
            </Alert>
          )}

          {splitResult && (
            <Card className="bg-muted/40" data-testid="split-result">
              <CardContent className="pt-6">
                {splitResult.totalFailed === 0 ? (
                  <p className="text-sm text-muted-foreground mb-3">
                    This file has no failed or errored tests, so both files below are identical full copies.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mb-3">
                    {splitResult.totalFailed} failed/errored test{splitResult.totalFailed !== 1 ? 's' : ''} split into{' '}
                    <strong className="text-foreground">{splitResult.countA}</strong> and <strong className="text-foreground">{splitResult.countB}</strong>. All passed and
                    skipped tests are included in both files.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button
                    className="bg-success text-success-foreground hover:bg-success/90"
                    onClick={() => downloadFile('test-results-split-a.xml', splitResult.fileAXml, 'application/xml')}
                  >
                    <DownloadIcon className="size-4" />
                    Download File A ({splitResult.countA})
                  </Button>
                  <Button
                    className="bg-success text-success-foreground hover:bg-success/90"
                    onClick={() => downloadFile('test-results-split-b.xml', splitResult.fileBXml, 'application/xml')}
                  >
                    <DownloadIcon className="size-4" />
                    Download File B ({splitResult.countB})
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Combine section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <MergeIcon className="size-6 text-purple-500" />
            Combine team results
          </CardTitle>
          <p className="text-muted-foreground pt-1">
            Once you've each worked your half on the Progress tab, export your progress there and upload both
            files here. This merges the test data and all failure-resolution notes into one combined report,
            without double-counting the passed/skipped tests both files share.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {([
              ['A', bundleAFile, setBundleAFile] as const,
              ['B', bundleBFile, setBundleBFile] as const,
            ]).map(([label, file, setFile]) => (
              <FileDropZone
                key={label}
                variant="compact"
                accept=".json"
                idleLabel={`Export ${label}`}
                selectedFileName={file?.name}
                aria-label={`Upload export ${label}`}
                onFileSelect={setFile}
              />
            ))}
          </div>

          <Button
            className="bg-purple-600 text-white hover:bg-purple-700"
            onClick={handleCombine}
            disabled={!bundleAFile || !bundleBFile}
          >
            <MergeIcon className="size-4" />
            Combine
          </Button>

          {combineError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircleIcon className="size-4" />
              <AlertDescription>{combineError}</AlertDescription>
            </Alert>
          )}

          {combineWarnings.map((w) => (
            <Alert key={w} className="mt-2 border-warning/30 bg-warning/5 text-warning [&>svg]:text-warning">
              <AlertCircleIcon className="size-4" />
              <AlertDescription className="text-warning">{w}</AlertDescription>
            </Alert>
          ))}

          {combinedData && (
            <Alert className="mt-4 border-success/30 bg-success/5" data-testid="combine-result">
              <CheckCircleIcon className="size-4 text-success" />
              <AlertDescription className="flex flex-col gap-3 text-success">
                <span>
                  Combined {combinedData.summary.total} tests ({combinedData.summary.failed} failed) with all
                  resolution progress merged.
                </span>
                <Button className="w-fit" onClick={() => setActiveTab('report')}>
                  Continue to Report
                  <ArrowRightIcon className="size-4" />
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
