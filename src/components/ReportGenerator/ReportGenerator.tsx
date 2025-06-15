import React, { useState } from 'react';
import { FileTextIcon, EyeIcon } from 'lucide-react';
import { ReportPreview } from './ReportPreview';
export const ReportGenerator = ({
  testData
}) => {
  const [reportConfig, setReportConfig] = useState({
    title: 'Automated Test Results Report',
    author: '',
    projectName: '',
    includeExecutiveSummary: true,
    includeTestMetrics: true,
    includeFailedTests: true,
    includeAllTests: false,
    includeResolutionProgress: false // Add new config option
  });
  const [showPreview, setShowPreview] = useState(false);
  const handleInputChange = e => {
    const {
      name,
      value,
      type,
      checked
    } = e.target;
    setReportConfig({
      ...reportConfig,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  const generateReport = () => {
    setShowPreview(true);
  };
  if (!testData) {
    return <div className="bg-white p-8 rounded-lg shadow text-center">
        <FileTextIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          No Test Data Available
        </h2>
        <p className="text-gray-600 mb-6">
          Please upload a JUnit XML file from the Dashboard to generate a
          report.
        </p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors" onClick={() => window.location.reload()}>
          Go to Dashboard
        </button>
      </div>;
  }
  if (showPreview) {
    return <ReportPreview testData={testData} config={reportConfig} onBack={() => setShowPreview(false)} />;
  }
  return <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Report Generator
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              Report Configuration
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Report Title
                </label>
                <input type="text" id="title" name="title" value={reportConfig.title} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-1">
                  Author
                </label>
                <input type="text" id="author" name="author" value={reportConfig.author} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Your name or organization" />
              </div>
              <div>
                <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name
                </label>
                <input type="text" id="projectName" name="projectName" value={reportConfig.projectName} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Name of the tested project" />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              Content Options
            </h3>
            <div className="space-y-4">
              <div className="flex items-center">
                <input type="checkbox" id="includeExecutiveSummary" name="includeExecutiveSummary" checked={reportConfig.includeExecutiveSummary} onChange={handleInputChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                <label htmlFor="includeExecutiveSummary" className="ml-2 block text-sm text-gray-700">
                  Include Executive Summary
                </label>
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="includeTestMetrics" name="includeTestMetrics" checked={reportConfig.includeTestMetrics} onChange={handleInputChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                <label htmlFor="includeTestMetrics" className="ml-2 block text-sm text-gray-700">
                  Include Test Metrics and Charts
                </label>
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="includeFailedTests" name="includeFailedTests" checked={reportConfig.includeFailedTests} onChange={handleInputChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                <label htmlFor="includeFailedTests" className="ml-2 block text-sm text-gray-700">
                  Include Failed Tests Details
                </label>
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="includeAllTests" name="includeAllTests" checked={reportConfig.includeAllTests} onChange={handleInputChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                <label htmlFor="includeAllTests" className="ml-2 block text-sm text-gray-700">
                  Include All Test Cases
                </label>
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="includeResolutionProgress" name="includeResolutionProgress" checked={reportConfig.includeResolutionProgress} onChange={handleInputChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                <label htmlFor="includeResolutionProgress" className="ml-2 block text-sm text-gray-700">
                  Include Failure Resolution Progress
                </label>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 flex space-x-4">
          <button onClick={generateReport} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            <EyeIcon className="w-5 h-5 mr-2" />
            Preview Report
          </button>
        </div>
      </div>
    </div>;
};