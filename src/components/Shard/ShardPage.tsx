import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  BoxesIcon,
  UploadIcon,
  DownloadIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  XIcon,
  FileIcon,
} from 'lucide-react';
import type { TestData } from '../../types';
import { mergeJUnitXml, type MergeResult, type JUnitXmlFile } from '../../utils/mergeJUnitXml';
import { parseJUnitXML } from '../../utils/xmlParser';
import { downloadFile, readFileAsText } from '../../utils/download';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ShardPageProps {
  onDataUpload: (data: TestData) => void;
  onXmlContent: (content: string) => void;
  setActiveTab: (tab: string) => void;
}

export const ShardPage: React.FC<ShardPageProps> = ({ onDataUpload, onXmlContent, setActiveTab }) => {
  const [shards, setShards] = useState<JUnitXmlFile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [mergedData, setMergedData] = useState<TestData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const clearResult = () => {
    setMergeError(null);
    setMergeResult(null);
    setMergedData(null);
  };

  const addFiles = async (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;
    setLoadError(null);
    clearResult();
    try {
      const loaded = await Promise.all(
        incoming.map(async (file) => ({ name: file.name, xml: await readFileAsText(file) }))
      );
      setShards((prev) => [...prev, ...loaded]);
    } catch {
      setLoadError('Could not read one or more of the selected files.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // input.files is a live FileList, so it must be materialized into a plain
    // array before e.target.value is reset below — otherwise resetting the
    // input empties the very FileList addFiles is about to read.
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length > 0) await addFiles(files);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) await addFiles(e.dataTransfer.files);
  };

  const removeShard = (index: number) => {
    clearResult();
    setShards((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCombine = () => {
    clearResult();
    try {
      const result = mergeJUnitXml(shards);
      setMergeResult(result);
      setMergedData(parseJUnitXML(result.xml));
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'Failed to combine these files.');
    }
  };

  const handleDownload = () => {
    if (!mergeResult) return;
    downloadFile('test-results-combined.xml', mergeResult.xml, 'application/xml');
  };

  const handleViewInDashboard = () => {
    if (!mergeResult || !mergedData) return;
    onDataUpload(mergedData);
    onXmlContent(mergeResult.xml);
    setActiveTab('dashboard');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <BoxesIcon className="size-6 text-primary" />
            Combine sharded test runs
          </CardTitle>
          <p className="text-muted-foreground pt-1">
            When Playwright tests run across multiple shards (e.g. <code>--shard=1/3</code>), each shard
            writes its own JUnit XML report covering a different slice of the suite. Upload every shard's
            report here to combine them into one JUnit XML file you can load into this app. Shards are
            assumed to cover different tests, so nothing is de-duplicated — every suite and test case from
            every file is kept.
          </p>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
            className={cn(
              'flex flex-wrap items-center gap-3 mb-4 rounded-lg border-2 border-dashed p-4 transition-colors',
              isDragging ? 'border-primary bg-primary/5' : 'border-border'
            )}
          >
            <input
              id="shard-file-upload"
              name="shardFileUpload"
              type="file"
              ref={inputRef}
              onChange={handleFileChange}
              accept=".xml"
              multiple
              className="hidden"
              aria-label="Upload JUnit XML shard reports"
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <UploadIcon className="size-4" />
              Choose XML Files
            </Button>
            <span className="text-sm text-muted-foreground hidden sm:inline">or drag shard reports here</span>
            <Button onClick={handleCombine} disabled={shards.length < 2} className="ml-auto">
              <BoxesIcon className="size-4" />
              Combine Shards
            </Button>
          </div>

          {loadError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircleIcon className="size-4" />
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {shards.length > 0 && (
            <ul className="mb-4 flex flex-col gap-2" aria-label="Uploaded shard reports">
              {shards.map((shard, index) => (
                <li
                  key={`${shard.name}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 truncate">
                    <FileIcon className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{shard.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeShard(index)}
                    aria-label={`Remove ${shard.name}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <XIcon className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {shards.length === 1 && (
            <p className="mb-4 text-sm text-muted-foreground">Add at least one more shard report to combine.</p>
          )}

          {mergeError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircleIcon className="size-4" />
              <AlertDescription>{mergeError}</AlertDescription>
            </Alert>
          )}

          {mergeResult?.warnings.map((w) => (
            <Alert key={w} className="mb-2 border-warning/30 bg-warning/5 text-warning [&>svg]:text-warning">
              <AlertCircleIcon className="size-4" />
              <AlertDescription className="text-warning">{w}</AlertDescription>
            </Alert>
          ))}

          {mergeResult && mergedData && (
            <Alert className="border-success/30 bg-success/5" data-testid="shard-result">
              <CheckCircleIcon className="size-4 text-success" />
              <AlertDescription className="flex flex-col gap-3 text-success">
                <span>
                  Combined {mergedData.summary.total} test{mergedData.summary.total !== 1 ? 's' : ''} (
                  {mergedData.summary.failed} failed) from {mergeResult.fileCount} files across{' '}
                  {mergeResult.suiteCount} suite{mergeResult.suiteCount !== 1 ? 's' : ''}.
                </span>
                <div className="flex flex-wrap gap-3">
                  <Button className="w-fit" onClick={handleDownload}>
                    <DownloadIcon className="size-4" />
                    Download Combined XML
                  </Button>
                  <Button className="w-fit" onClick={handleViewInDashboard}>
                    View in Dashboard
                    <ArrowRightIcon className="size-4" />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
