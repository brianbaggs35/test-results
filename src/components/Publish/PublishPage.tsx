import React, { useState, useRef } from 'react';
import { SendIcon, FileIcon, UploadIcon, LoaderIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react';

export interface PublishPageProps {
  xmlContent: string | null;
}

interface MetadataEntry {
  key: string;
  value: string;
}

interface PublishStatus {
  state: 'idle' | 'publishing' | 'success' | 'error';
  message: string;
  output?: string;
}

export const PublishPage: React.FC<PublishPageProps> = ({ xmlContent }) => {
  const [run, setRun] = useState('');
  const [title, setTitle] = useState('');
  const [metadata, setMetadata] = useState<MetadataEntry[]>([
    { key: '', value: '' },
    { key: '', value: '' },
  ]);
  const [xmlSource, setXmlSource] = useState<'loaded' | 'file'>(xmlContent ? 'loaded' : 'file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<PublishStatus>({ state: 'idle', message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMetadataChange = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...metadata];
    updated[index] = { ...updated[index], [field]: val };
    setMetadata(updated);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setXmlSource('file');
    }
  };

  const getXmlContent = async (): Promise<string | null> => {
    if (xmlSource === 'loaded' && xmlContent) {
      return xmlContent;
    }
    if (xmlSource === 'file' && selectedFile) {
      return await selectedFile.text();
    }
    return null;
  };

  const handlePublish = async () => {
    if (!run.trim() || !title.trim()) {
      setStatus({ state: 'error', message: 'Run and Title are required fields.' });
      return;
    }

    const xml = await getXmlContent();
    if (!xml) {
      setStatus({ state: 'error', message: 'Please provide an XML file for publishing.' });
      return;
    }

    setStatus({ state: 'publishing', message: 'Publishing test results...' });

    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run: run.trim(),
          title: title.trim(),
          metadata: metadata.filter(m => m.key.trim()),
          xmlContent: xml,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus({
          state: 'success',
          message: 'Test results published successfully!',
          output: result.stdout || result.stderr,
        });
      } else {
        setStatus({
          state: 'error',
          message: result.error || 'Publishing failed.',
          output: result.stdout || result.stderr,
        });
      }
    } catch (err) {
      setStatus({
        state: 'error',
        message: err instanceof Error ? err.message : 'Failed to publish. Is the dev server running?',
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Publish Test Results
        </h2>
        <p className="text-gray-600 mb-6">
          Configure and publish your test results using TestBeats.
        </p>

        <div className="space-y-6">
          {/* Run Name */}
          <div>
            <label htmlFor="publish-run" className="block text-sm font-medium text-gray-700 mb-1">
              Run Name
            </label>
            <input
              type="text"
              id="publish-run"
              value={run}
              onChange={(e) => setRun(e.target.value)}
              placeholder="e.g., Full Regression February 17th"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Title */}
          <div>
            <label htmlFor="publish-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              id="publish-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Full Regression February 17th"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Metadata */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Metadata</h3>
            {metadata.map((entry, index) => (
              <div key={index} className="flex gap-4 mb-3">
                <div className="flex-1">
                  <label htmlFor={`metadata-key-${index}`} className="block text-xs text-gray-500 mb-1">
                    Key
                  </label>
                  <input
                    type="text"
                    id={`metadata-key-${index}`}
                    value={entry.key}
                    onChange={(e) => handleMetadataChange(index, 'key', e.target.value)}
                    placeholder={index === 0 ? 'e.g., Failed Tests' : 'e.g., Executed By'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor={`metadata-value-${index}`} className="block text-xs text-gray-500 mb-1">
                    Value
                  </label>
                  <input
                    type="text"
                    id={`metadata-value-${index}`}
                    value={entry.value}
                    onChange={(e) => handleMetadataChange(index, 'value', e.target.value)}
                    placeholder={index === 0 ? 'e.g., 54' : 'e.g., Brian'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* XML Source */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Test Results XML</h3>
            <div className="space-y-3">
              {xmlContent && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="xmlSource"
                    value="loaded"
                    checked={xmlSource === 'loaded'}
                    onChange={() => setXmlSource('loaded')}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Use loaded XML file from Dashboard</span>
                </label>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="xmlSource"
                  value="file"
                  checked={xmlSource === 'file'}
                  onChange={() => setXmlSource('file')}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">Choose a new XML file</span>
              </label>
              {xmlSource === 'file' && (
                <div className="flex items-center gap-3 mt-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xml"
                    className="hidden"
                    data-testid="xml-file-input"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <UploadIcon className="w-4 h-4 mr-2" />
                    {selectedFile ? 'Change File' : 'Select XML File'}
                  </button>
                  {selectedFile && (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <FileIcon className="w-4 h-4" />
                      {selectedFile.name}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Publish Button */}
          <div className="pt-4">
            <button
              onClick={handlePublish}
              disabled={status.state === 'publishing'}
              className="flex items-center px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status.state === 'publishing' ? (
                <>
                  <LoaderIcon className="w-5 h-5 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <SendIcon className="w-5 h-5 mr-2" />
                  Publish
                </>
              )}
            </button>
          </div>

          {/* Status Display */}
          {status.state !== 'idle' && status.state !== 'publishing' && (
            <div
              className={`p-4 rounded-md ${
                status.state === 'success'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
              data-testid="publish-status"
            >
              <div className="flex items-center gap-2 mb-2">
                {status.state === 'success' ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-red-600" />
                )}
                <span
                  className={`font-medium ${
                    status.state === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}
                >
                  {status.message}
                </span>
              </div>
              {status.output && (
                <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded text-sm overflow-x-auto whitespace-pre-wrap">
                  {status.output}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
