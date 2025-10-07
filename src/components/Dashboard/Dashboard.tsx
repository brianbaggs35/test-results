import { useState } from 'react';
import { FileUploader } from './FileUploader';
import { TestMetrics } from './TestMetrics';
import { TestResultsList } from './TestResultsList';
import { parseJUnitXML } from '../../utils/xmlParser';
import ClearLocalStorageButton from './ClearLocalStorage';
import type { TestData } from '../../types';

interface DashboardProps {
  onDataUpload: (data: TestData) => void;
  testData: TestData | null;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onDataUpload,
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
    } catch (err) {
      console.error('Error parsing file:', err);
      setError('Failed to parse the XML file. Please ensure it is a valid JUnit XML file.');
    } finally {
      setIsLoading(false);
    }
  };
  return <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Test Results Dashboard
        </h2>
        <div className="flex mb-4">
          <ClearLocalStorageButton />
        </div>
        {!testData && <FileUploader onFileUpload={handleFileUpload} isLoading={isLoading} error={error} />}
      </div>
      {testData && <>
          <TestMetrics testData={testData} />
          <TestResultsList testData={testData} />
        </>}
    </div>;
};