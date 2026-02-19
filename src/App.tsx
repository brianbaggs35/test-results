import { useState } from 'react';
import { Navbar } from './components/Layout/Navbar';
import { Dashboard } from './components/Dashboard/Dashboard';
import { ReportGenerator } from './components/ReportGenerator/ReportGenerator';
import { FailureAnalysisPage } from './components/FailureAnalysis/FailureAnalysisPage';
import { FailureAnalysisProgress } from './components/FailureAnalysis/FailureAnalysisProgress';
import { PublishPage } from './components/Publish/PublishPage';
import type { TestData } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [testData, setTestData] = useState<TestData | null>(null);
  const [xmlContent, setXmlContent] = useState<string | null>(null);

  const handleDataUpload = (data: TestData) => {
    setTestData(data);
  };

  const handleXmlContent = (content: string) => {
    setXmlContent(content);
  };

  const getActiveComponent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onDataUpload={handleDataUpload} onXmlContent={handleXmlContent} testData={testData} />;
      case 'failures':
        return <FailureAnalysisPage testData={testData} />;
      case 'progress':
        return <FailureAnalysisProgress testData={testData} />;
      case 'report':
        return <ReportGenerator testData={testData} />;
      case 'publish':
        return <PublishPage xmlContent={xmlContent} />;
      default:
        return <Dashboard onDataUpload={handleDataUpload} onXmlContent={handleXmlContent} testData={testData} />;
    }
  };
  return <div className="min-h-screen bg-gray-50">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="container mx-auto px-4 py-8">
        {getActiveComponent()}
      </main>
    </div>;
}
