import React, { useState } from 'react';
import { FileUploader } from './FileUploader';
import { TestMetrics } from './TestMetrics';
import { TestResultsList } from './TestResultsList';
import { parseJUnitXML } from '../../utils/xmlParser';
export const Dashboard = ({
  onDataUpload,
  testData
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const handleFileUpload = async file => {
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
        {!testData && <FileUploader onFileUpload={handleFileUpload} isLoading={isLoading} error={error} />}
      </div>
      {testData && <>
          <TestMetrics testData={testData} />
          <TestResultsList testData={testData} />
        </>}
    </div>;
};