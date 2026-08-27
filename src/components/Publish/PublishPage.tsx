import React, { useState, useRef } from 'react';
import { SendIcon, FileIcon, UploadIcon, LoaderIcon, CheckCircleIcon, XCircleIcon, PlusIcon, XIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { parseJUnitXML } from '@/utils/xmlParser';
import type { TestData } from '@/types';

export interface PublishPageProps {
  testData: TestData | null;
}

interface MetadataEntry {
  key: string;
  value: string;
}

interface PublishStatus {
  state: 'idle' | 'publishing' | 'success' | 'error';
  message: string;
}

const METADATA_PLACEHOLDERS = [
  { key: 'e.g., Failed Tests', value: 'e.g., 54' },
  { key: 'e.g., Executed By', value: 'e.g., Brian' },
];

const MAX_METADATA_ENTRIES = 6;

/**
 * Row 0's key is always pre-filled with "Failed Tests" — its value is left
 * for the user to fill in by hand, since the parsed XML's failure count
 * includes flaky-test retries and would overstate the real number. Row 1
 * ("Executed By") is only pre-filled, key and value together, when
 * VITE_EXECUTED_BY is set, so the same person doesn't have to retype their
 * own name on every publish.
 */
const buildInitialMetadata = (): MetadataEntry[] => {
  const executedBy = import.meta.env.VITE_EXECUTED_BY;
  return [
    { key: 'Failed Tests', value: '' },
    executedBy ? { key: 'Executed By', value: executedBy } : { key: '', value: '' },
  ];
};

export const PublishPage: React.FC<PublishPageProps> = ({ testData }) => {
  const [title, setTitle] = useState('');
  const [metadata, setMetadata] = useState<MetadataEntry[]>(buildInitialMetadata);
  const [xmlSource, setXmlSource] = useState<'loaded' | 'file'>(testData ? 'loaded' : 'file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<PublishStatus>({ state: 'idle', message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMetadataChange = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...metadata];
    updated[index] = { ...updated[index], [field]: val };
    setMetadata(updated);
  };

  const addMetadataRow = () => {
    if (metadata.length >= MAX_METADATA_ENTRIES) return;
    setMetadata([...metadata, { key: '', value: '' }]);
  };

  const removeMetadataRow = (index: number) => {
    setMetadata(metadata.filter((_, i) => i !== index));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setXmlSource('file');
    }
  };

  const getTestData = async (): Promise<TestData | null> => {
    if (xmlSource === 'loaded' && testData) {
      return testData;
    }
    if (xmlSource === 'file' && selectedFile) {
      const content = await selectedFile.text();
      return parseJUnitXML(content);
    }
    return null;
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      setStatus({ state: 'error', message: 'Title is a required field.' });
      return;
    }

    let dataToPublish: TestData | null;
    try {
      dataToPublish = await getTestData();
    } catch {
      setStatus({ state: 'error', message: 'Could not parse the selected file. Make sure it is valid JUnit XML.' });
      return;
    }

    if (!dataToPublish) {
      setStatus({ state: 'error', message: 'Please provide an XML file for publishing.' });
      return;
    }

    setStatus({ state: 'publishing', message: 'Publishing test results...' });

    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          // Both sides required now that a key can be pre-filled (e.g.
          // "Failed Tests") without its value being filled in yet.
          metadata: metadata.filter(m => m.key.trim() && m.value.trim()),
          testData: dataToPublish,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus({
          state: 'success',
          message: 'Test results published to Slack!',
        });
      } else {
        setStatus({
          state: 'error',
          message: result.error || 'Publishing failed.',
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
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Publish Test Results</CardTitle>
          <p className="text-muted-foreground pt-1">
            Send a summary of your test results directly to a Slack channel.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="publish-title">Title</Label>
            <Input
              id="publish-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Full Regression February 17th"
            />
          </div>

          {/* Metadata */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Metadata</h3>
            <div className="space-y-3">
              {metadata.map((entry, index) => (
                <div key={index} className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`metadata-key-${index}`} className="text-xs text-muted-foreground">
                      Key
                    </Label>
                    <Input
                      id={`metadata-key-${index}`}
                      value={entry.key}
                      onChange={(e) => handleMetadataChange(index, 'key', e.target.value)}
                      placeholder={METADATA_PLACEHOLDERS[index]?.key ?? 'e.g., Environment'}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`metadata-value-${index}`} className="text-xs text-muted-foreground">
                      Value
                    </Label>
                    <Input
                      id={`metadata-value-${index}`}
                      value={entry.value}
                      onChange={(e) => handleMetadataChange(index, 'value', e.target.value)}
                      placeholder={METADATA_PLACEHOLDERS[index]?.value ?? 'e.g., Staging'}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMetadataRow(index)}
                    aria-label="Remove metadata row"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addMetadataRow}
              disabled={metadata.length >= MAX_METADATA_ENTRIES}
              title={metadata.length >= MAX_METADATA_ENTRIES ? `Maximum of ${MAX_METADATA_ENTRIES} metadata entries` : undefined}
              className="mt-3"
            >
              <PlusIcon className="size-4" />
              Add metadata
            </Button>
          </div>

          {/* XML Source */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Test Results XML</h3>
            <div className="space-y-3">
              {testData && (
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="xmlSource"
                    value="loaded"
                    checked={xmlSource === 'loaded'}
                    onChange={() => setXmlSource('loaded')}
                    className="text-primary accent-primary"
                  />
                  Use loaded XML file from Dashboard
                </label>
              )}
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="xmlSource"
                  value="file"
                  checked={xmlSource === 'file'}
                  onChange={() => setXmlSource('file')}
                  className="text-primary accent-primary"
                />
                Choose a new XML file
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
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <UploadIcon className="size-4" />
                    {selectedFile ? 'Change File' : 'Select XML File'}
                  </Button>
                  {selectedFile && (
                    <span className="text-sm text-success flex items-center gap-1">
                      <FileIcon className="size-4" />
                      {selectedFile.name}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Publish Button */}
          <div className="pt-4">
            <Button
              size="lg"
              onClick={handlePublish}
              disabled={status.state === 'publishing'}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              {status.state === 'publishing' ? (
                <>
                  <LoaderIcon className="size-5 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <SendIcon className="size-5" />
                  Publish
                </>
              )}
            </Button>
          </div>

          {/* Status Display */}
          {status.state !== 'idle' && status.state !== 'publishing' && (
            <Alert
              className={cn(
                status.state === 'success'
                  ? 'border-success/30 bg-success/5'
                  : 'border-destructive/30 bg-destructive/5'
              )}
              data-testid="publish-status"
            >
              {status.state === 'success' ? (
                <CheckCircleIcon className="size-4 text-success" />
              ) : (
                <XCircleIcon className="size-4 text-destructive" />
              )}
              <AlertDescription className={status.state === 'success' ? 'text-success' : 'text-destructive'}>
                <span className="font-medium">{status.message}</span>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
