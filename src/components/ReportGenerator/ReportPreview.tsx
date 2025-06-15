import React, { useState } from 'react';
import { ArrowLeftIcon, DownloadIcon, BookOpenIcon, CheckIcon, XIcon, AlertCircleIcon, LoaderIcon } from 'lucide-react';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';
import { formatDuration } from '../../utils/formatting';
import { generatePDF } from './pdfGenerator';
import { PDFPreviewFrame } from './PDFPreviewFrame';
export const ReportPreview = ({
  testData,
  config,
  onBack
}) => {
  const {
    summary
  } = testData;
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const handleGeneratePDF = async () => {
    setIsGeneratingPDF(true);
    setPdfError(null);
    setGenerationProgress(0);
    try {
      await generatePDF(testData, config, progress => {
        setGenerationProgress(Math.round(progress));
      });
    } catch (error) {
      setPdfError('Failed to generate PDF. Please try again.');
      console.error('PDF Generation Error:', error);
    } finally {
      setIsGeneratingPDF(false);
      setGenerationProgress(0);
    }
  };
  // Add the renderCustomizedLabel function
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    value,
    name
  }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.7;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    // Don't show labels for very small segments
    if (percent < 0.02) {
      return null;
    }
    return <text x={x} y={y} fill="#4B5563" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-medium">
        {value} ({(percent * 100).toFixed(0)}%)
      </text>;
  };
  // Add the CustomTooltip component
  const CustomTooltip = ({
    active,
    payload
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-medium text-gray-900">{data.name}</p>
          <p className="text-gray-600">
            {data.value} test{data.value !== 1 ? 's' : ''}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {(data.value / summary.total * 100).toFixed(1)}% of total
          </p>
        </div>;
    }
    return null;
  };
  const statusData = [{
    name: 'Passed',
    value: summary.passed,
    color: '#10B981'
  }, {
    name: 'Failed',
    value: summary.failed,
    color: '#EF4444'
  }, {
    name: 'Skipped',
    value: summary.skipped,
    color: '#F59E0B'
  }];
  // Get failed tests for report
  const failedTests = testData.suites.flatMap(suite => suite.testcases.filter(test => test.status === 'failed').map(test => ({
    ...test,
    suite: suite.name
  })));
  const getStatusIcon = status => {
    switch (status) {
      case 'passed':
        return <CheckIcon className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XIcon className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircleIcon className="w-4 h-4 text-yellow-500" />;
    }
  };
  return <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors">
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          Back to Configuration
        </button>
        <div className="flex items-center gap-4">
          {pdfError && <span className="text-red-600 text-sm">{pdfError}</span>}
          {isGeneratingPDF && <div className="flex items-center">
              <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                <div className="bg-green-600 h-2 rounded-full transition-all duration-300" style={{
              width: `${generationProgress}%`
            }} />
              </div>
              <span className="text-sm text-gray-600">
                {generationProgress}%
              </span>
            </div>}
          <button onClick={handleGeneratePDF} disabled={isGeneratingPDF} className={`flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors ${isGeneratingPDF ? 'opacity-75 cursor-not-allowed' : ''}`}>
            {isGeneratingPDF ? <>
                <LoaderIcon className="w-5 h-5 mr-2 animate-spin" />
                Generating PDF...
              </> : <>
                <DownloadIcon className="w-5 h-5 mr-2" />
                Download PDF
              </>}
          </button>
        </div>
      </div>
      <div id="report-preview" className="bg-white p-8 rounded-lg shadow print:shadow-none">
        <div className="max-w-4xl mx-auto">
          {/* Title Page */}
          <div className="mb-12 pb-12 border-b border-gray-200">
            <h1 className="text-4xl font-bold text-center text-gray-800 mb-6">
              {config.title}
            </h1>
            {config.projectName && <h2 className="text-2xl font-semibold text-center text-gray-600 mb-8">
                {config.projectName}
              </h2>}
            <div className="flex justify-center items-center mb-8">
              <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full">
                Generated on {new Date().toLocaleDateString()}
              </div>
            </div>
            {config.author && <p className="text-center text-gray-600">
                Prepared by: {config.author}
              </p>}
          </div>
          {/* Table of Contents */}
          <div className="mb-12 pb-12 border-b border-gray-200 page-break-after">
            <div className="flex items-center mb-6">
              <BookOpenIcon className="w-6 h-6 text-blue-600 mr-2" />
              <h2 className="text-2xl font-bold text-gray-800">
                Table of Contents
              </h2>
            </div>
            <ul className="space-y-3">
              <li className="flex items-center">
                <span className="text-blue-600 font-medium mr-2">1.</span>
                <a href="#executive-summary" className="text-blue-600 hover:underline">
                  Executive Summary
                </a>
              </li>
              <li className="flex items-center">
                <span className="text-blue-600 font-medium mr-2">2.</span>
                <a href="#test-metrics" className="text-blue-600 hover:underline">
                  Test Metrics
                </a>
              </li>
              <li className="flex items-center">
                <span className="text-blue-600 font-medium mr-2">3.</span>
                <a href="#failed-tests" className="text-blue-600 hover:underline">
                  Failed Tests
                </a>
              </li>
              {config.includeAllTests && <li className="flex items-center">
                  <span className="text-blue-600 font-medium mr-2">4.</span>
                  <a href="#all-tests" className="text-blue-600 hover:underline">
                    All Test Cases
                  </a>
                </li>}
            </ul>
          </div>
          {/* Executive Summary */}
          {config.includeExecutiveSummary && <div id="executive-summary" className="mb-12 pb-12 border-b border-gray-200 page-break-before avoid-break">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                1. Executive Summary
              </h2>
              <div className="bg-gray-50 p-6 rounded-lg">
                <p className="text-gray-700 mb-4">
                  This report provides an overview of the automated test results
                  for {config.projectName || 'the project'}. The tests were
                  executed on {new Date().toLocaleDateString()} with a total
                  duration of {formatDuration(summary.time)}.
                </p>
                {/* Test Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white p-4 rounded shadow">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-medium text-gray-700">
                        Total Tests
                      </h4>
                      <span className="text-2xl font-bold text-blue-600">
                        {summary.total}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded shadow">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-medium text-gray-700">
                        Pass Rate
                      </h4>
                      <span className="text-2xl font-bold text-green-600">
                        {(summary.passed / summary.total * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded shadow">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-medium text-gray-700">
                        Duration
                      </h4>
                      <span className="text-xl font-bold text-purple-600">
                        {formatDuration(summary.time)}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Failed Tests Summary if any */}
                {summary.failed > 0 && <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                    <h4 className="text-lg font-medium text-red-800 mb-2">
                      Failed Tests Summary
                    </h4>
                    <p className="text-red-700">
                      {summary.failed} test{summary.failed > 1 ? 's' : ''}{' '}
                      failed (
                      {(summary.failed / summary.total * 100).toFixed(1)}% of
                      total tests)
                    </p>
                    <ul className="mt-2 space-y-1">
                      {testData.suites.flatMap(suite => suite.testcases.filter(test => test.status === 'failed').map((test, index) => <li key={index} className="text-sm text-red-600">
                              • {test.name} ({test.suite})
                            </li>))}
                    </ul>
                  </div>}
                <p className="text-gray-700">
                  {summary.failed > 0 ? `There were ${summary.failed} failed tests that require attention. Key areas to focus on include reviewing the failed test cases and addressing the underlying issues.` : `All tests passed successfully. The test suite is performing as expected.`}
                </p>
              </div>
            </div>}
          {/* Test Metrics */}
          {config.includeTestMetrics && <div id="test-metrics" className="mb-12 pb-12 border-b border-gray-200 page-break-before avoid-break">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                2. Test Metrics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">
                    Test Results Distribution
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={0} dataKey="value" labelLine={false} label={renderCustomizedLabel} minAngle={2}>
                          {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip active={false} payload={[]} />} />
                        <Legend verticalAlign="bottom" height={36} formatter={(value, entry) => <span style={{
                      color: entry.color,
                      fontWeight: 500,
                      padding: '0 8px'
                    }}>
                              {value}
                            </span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">
                    Test Results Summary
                  </h3>
                  <table className="min-w-full divide-y divide-gray-200 avoid-break">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Metric
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          Total Tests
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {summary.total}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          Passed Tests
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-medium">
                          {summary.passed} (
                          {(summary.passed / summary.total * 100).toFixed(1)}
                          %)
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          Failed Tests
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 font-medium">
                          {summary.failed} (
                          {(summary.failed / summary.total * 100).toFixed(1)}
                          %)
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          Skipped Tests
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-yellow-600 font-medium">
                          {summary.skipped} (
                          {(summary.skipped / summary.total * 100).toFixed(1)}
                          %)
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          Total Duration
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDuration(summary.time)} (
                          {summary.time.toFixed(2)} seconds)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>}
          {/* Failed Tests */}
          {config.includeFailedTests && <div id="failed-tests" className="mb-12 pb-12 border-b border-gray-200 page-break-before avoid-break">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                3. Failed Tests
              </h2>
              {failedTests.length > 0 ? <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 avoid-break">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Test Name
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Suite
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Duration
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Error Message
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {failedTests.map((test, index) => <tr key={index}>
                          <td className="px-4 py-3 text-sm font-medium text-red-600 break-words">
                            {test.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 break-words">
                            {test.suite}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {parseFloat(test.time).toFixed(2)}s
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 break-words max-w-xs">
                            {test.errorMessage || 'No error message provided'}
                          </td>
                        </tr>)}
                    </tbody>
                  </table>
                </div> : <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="flex">
                    <CheckIcon className="h-5 w-5 text-green-400 mr-2" />
                    <p className="text-green-700">
                      No failed tests were found. All tests passed successfully!
                    </p>
                  </div>
                </div>}
            </div>}
          {/* All Tests */}
          {config.includeAllTests && <div id="all-tests" className="mb-12 page-break-before avoid-break">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                4. All Test Cases
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 avoid-break">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Test Name
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Suite
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {testData.suites.flatMap(suite => suite.testcases.map((test, testIndex) => <tr key={`${suite.name}-${testIndex}`}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 break-words">
                            {test.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 break-words">
                            {suite.name}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              {getStatusIcon(test.status)}
                              <span className={`ml-2 text-sm ${test.status === 'passed' ? 'text-green-800' : test.status === 'failed' ? 'text-red-800' : 'text-yellow-800'}`}>
                                {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {parseFloat(test.time).toFixed(2)}s
                          </td>
                        </tr>))}
                  </tbody>
                </table>
              </div>
            </div>}
          {config.includeResolutionProgress && <div id="resolution-progress" className="mb-12 pb-12 border-b border-gray-200 page-break-before avoid-break">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                5. Failure Resolution Progress
              </h2>
              {(() => {
            const savedProgress = localStorage.getItem('testFixProgress');
            const progressData = savedProgress ? JSON.parse(savedProgress) : {};
            const failedTests = Object.values(progressData);
            const totalTests = failedTests.length;
            const completedTests = failedTests.filter(test => test.status === 'completed').length;
            const inProgressTests = failedTests.filter(test => test.status === 'in_progress').length;
            return <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">
                            Total Failed Tests
                          </span>
                          <span className="text-xl font-bold text-gray-800">
                            {totalTests}
                          </span>
                        </div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-green-600">Completed</span>
                          <span className="text-xl font-bold text-green-700">
                            {completedTests}
                          </span>
                        </div>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-blue-600">In Progress</span>
                          <span className="text-xl font-bold text-blue-700">
                            {inProgressTests}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 avoid-break">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Test Name
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Suite
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Assignee
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Notes
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {failedTests.map((test: any, index: number) => <tr key={index}>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 break-words">
                                {test.name}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500 break-words">
                                {test.suite}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                  ${test.status === 'completed' ? 'bg-green-100 text-green-800' : test.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                                  {test.status.replace('_', ' ').charAt(0).toUpperCase() + test.status.slice(1)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500 break-words">
                                {test.assignee || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500 break-words">
                                {test.notes || '-'}
                              </td>
                            </tr>)}
                        </tbody>
                      </table>
                    </div>
                  </div>;
          })()}
            </div>}
        </div>
      </div>
      
      {/* Hidden PDF Preview Frame - optimized for PDF generation */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', visibility: 'hidden' }}>
        <PDFPreviewFrame testData={testData} config={config} />
      </div>
    </div>;
};