import { useRef, useState } from 'react';
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
import { downloadFile, readFileAsText } from '../../utils/download';

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
  const splitInputRef = useRef<HTMLInputElement>(null);

  const handleSplitFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center mb-2">
          <SplitIcon className="w-6 h-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-bold text-gray-800">Split a report for your team</h2>
        </div>
        <p className="text-gray-600 mb-4">
          Divides the failed/errored tests across two new JUnit XML files, keeping every test suite's
          failures together in just one of the two — so two people working from file A and file B never
          end up editing tests in the same suite. Every passed and skipped test stays in both. The split
          is deterministic: running it on the same file produces the same two files no matter who runs
          it or on which machine, though the two halves won't always come out perfectly even.
        </p>

        <div className="flex items-center gap-3 mb-4">
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
          <button
            onClick={() => splitInputRef.current?.click()}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <UploadIcon className="w-4 h-4 mr-2" />
            Choose XML File
          </button>
          {sourceName && <span className="text-sm text-gray-500">Using: {sourceName}</span>}
          <button
            onClick={handleSplit}
            disabled={!sourceXml}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
          >
            <SplitIcon className="w-4 h-4 mr-2" />
            Split
          </button>
        </div>

        {splitError && (
          <div className="flex items-center text-red-600 text-sm mb-4">
            <AlertCircleIcon className="w-4 h-4 mr-2" />
            {splitError}
          </div>
        )}

        {splitResult && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4" data-testid="split-result">
            {splitResult.totalFailed === 0 ? (
              <p className="text-sm text-gray-600 mb-3">
                This file has no failed or errored tests, so both files below are identical full copies.
              </p>
            ) : (
              <p className="text-sm text-gray-600 mb-3">
                {splitResult.totalFailed} failed/errored test{splitResult.totalFailed !== 1 ? 's' : ''} split into{' '}
                <strong>{splitResult.countA}</strong> and <strong>{splitResult.countB}</strong>. All passed and
                skipped tests are included in both files.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => downloadFile('test-results-split-a.xml', splitResult.fileAXml, 'application/xml')}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                <DownloadIcon className="w-4 h-4 mr-2" />
                Download File A ({splitResult.countA})
              </button>
              <button
                onClick={() => downloadFile('test-results-split-b.xml', splitResult.fileBXml, 'application/xml')}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                <DownloadIcon className="w-4 h-4 mr-2" />
                Download File B ({splitResult.countB})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Combine section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center mb-2">
          <MergeIcon className="w-6 h-6 text-purple-600 mr-2" />
          <h2 className="text-2xl font-bold text-gray-800">Combine team results</h2>
        </div>
        <p className="text-gray-600 mb-4">
          Once you've each worked your half on the Progress tab, export your progress there and upload both
          files here. This merges the test data and all failure-resolution notes into one combined report,
          without double-counting the passed/skipped tests both files share.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {([
            ['A', bundleAFile, setBundleAFile] as const,
            ['B', bundleBFile, setBundleBFile] as const,
          ]).map(([label, file, setFile]) => (
            <label
              key={label}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100"
            >
              <span className="text-sm font-medium text-gray-700 mb-2">Export {label}</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                aria-label={`Upload export ${label}`}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span className="text-xs text-gray-500">{file ? file.name : 'Click to choose a file'}</span>
            </label>
          ))}
        </div>

        <button
          onClick={handleCombine}
          disabled={!bundleAFile || !bundleBFile}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MergeIcon className="w-4 h-4 mr-2" />
          Combine
        </button>

        {combineError && (
          <div className="flex items-center text-red-600 text-sm mt-4">
            <AlertCircleIcon className="w-4 h-4 mr-2" />
            {combineError}
          </div>
        )}

        {combineWarnings.map((w) => (
          <div key={w} className="flex items-center text-amber-600 text-sm mt-2">
            <AlertCircleIcon className="w-4 h-4 mr-2 shrink-0" />
            {w}
          </div>
        ))}

        {combinedData && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4" data-testid="combine-result">
            <div className="flex items-center text-green-700 mb-2">
              <CheckCircleIcon className="w-5 h-5 mr-2" />
              Combined {combinedData.summary.total} tests ({combinedData.summary.failed} failed) with all
              resolution progress merged.
            </div>
            <button
              onClick={() => setActiveTab('report')}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Continue to Report
              <ArrowRightIcon className="w-4 h-4 ml-2" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
