import { useState } from 'react';
import { FileUploader } from './FileUploader';
import { TestMetrics } from './TestMetrics';
import { TestResultsList } from './TestResultsList';
import { parseJUnitXML } from '../../utils/xmlParser';
import ClearLocalStorageButton from './ClearLocalStorage';
import type { TestData } from '../../types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface DashboardProps {
  onDataUpload: (data: TestData) => void;
  onXmlContent?: (content: string) => void;
  testData: TestData | null;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onDataUpload,
  onXmlContent,
  testData
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const fileContent = await file.text();
      const parsedData = parseJUnitXML(fileContent);
      onDataUpload(parsedData);
      onXmlContent?.(fileContent);
    } catch (err) {
      console.error('Error parsing file:', err);
      setError('Failed to parse the XML file. Please ensure it is a valid JUnit XML file.');
    } finally {
      setIsLoading(false);
    }
  };
  return <div className="space-y-8">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Test Results Dashboard
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a JUnit XML file from your Playwright run to explore results, track failures, and build reports.
            </p>
          </div>
          <ClearLocalStorageButton />
        </CardHeader>
        {!testData && (
          <CardContent>
            <FileUploader onFileUpload={handleFileUpload} isLoading={isLoading} error={error} />
          </CardContent>
        )}
      </Card>
      {testData && <>
          <TestMetrics testData={testData} />
          <TestResultsList testData={testData} />
        </>}
    </div>;
};
