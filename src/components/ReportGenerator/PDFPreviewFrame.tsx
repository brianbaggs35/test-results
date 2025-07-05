import { BookOpenIcon, CheckIcon, XIcon, AlertCircleIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatDuration } from '../../utils/formatting';
import { TestData, ReportConfig } from '../../types';
import { useChartRenderComplete } from '../../hooks/useChartRenderComplete';

export const PDFPreviewFrame = ({ testData, config }: { testData: TestData; config: ReportConfig }) => {
  const { summary } = testData;

  // Use custom hook to add chart-render-complete class for PDF generation
  useChartRenderComplete([testData]);

  const statusData = [
    { name: 'Passed', value: summary.passed, color: '#10B981' },
    { name: 'Failed', value: summary.failed, color: '#EF4444' },
    { name: 'Skipped', value: summary.skipped, color: '#F59E0B' }
  ];

  const failedTests = testData.suites.flatMap((suite) =>
    suite.testcases
      .filter((test) => test.status === 'failed')
      .map((test) => ({ ...test, suite: suite.name }))
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckIcon className="w-3 h-3 text-green-500" />;
      case 'failed':
        return <XIcon className="w-3 h-3 text-red-500" />;
      default:
        return <AlertCircleIcon className="w-3 h-3 text-yellow-500" />;
    }
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
    value: number;
  }) => {
    if (percent < 0.02) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 1.0; // Moved labels slightly outward
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#374151" // Darker color for better contrast
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        style={{ fontSize: '11px', fontWeight: '600' }} // Increased size and weight
      >
        {value} ({(percent * 100).toFixed(0)}%)
      </text>
    );
  };

  const CustomTooltip = ({ active, payload }: {
    active?: boolean;
    payload?: Array<{ payload: { name: string; value: number } }>;
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-2 rounded shadow border text-xs">
          <p className="font-medium text-gray-900">{data.name}</p>
          <p className="text-gray-600">{data.value} test{data.value !== 1 ? 's' : ''}</p>
          <p className="text-gray-500">{(data.value / summary.total * 100).toFixed(1)}% of total</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="report-preview"
      className="pdf-frame"
      style={{
        width: '794px', // Reduced from 300mm to fit A4 page width (210mm - 20mm for left/right margins)
        height: '1123px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white',
        transform: 'scale(0.6)', // Adjusted scale for better fit
        transformOrigin: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '12px', // Increased from 11px
        lineHeight: '1.5', // Increased from 1.4 for better readability
        color: '#374151',
        padding: '10mm 15mm 10mm 15mm', // Increased left/right padding to better center content within A4 margins
        margin: 'auto', // Center the frame horizontally
        boxSizing: 'border-box'
      }}
    >
      {/* Title Page */}
      <div style={{ marginBottom: '20mm', paddingBottom: '10mm', borderBottom: '1px solid #e5e7eb' }}>
        <h1 style={{
          fontSize: '24px', // Increased from 22px
          fontWeight: 'bold',
          textAlign: 'center',
          color: '#1f2937',
          marginBottom: '16px', // Increased spacing
          lineHeight: '1.2'
        }}>
          {config.title}
        </h1>
        {config.projectName && (
          <h2 style={{
            fontSize: '20px', // Increased from 18px
            fontWeight: '600',
            textAlign: 'center',
            color: '#6b7280',
            marginBottom: '20px' // Increased spacing
          }}>
            {config.projectName}
          </h2>
        )}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            backgroundColor: '#dbeafe',
            color: '#1e40af',
            padding: '10px 20px',
            borderRadius: '20px',
            display: 'inline-block',
            fontSize: '13px'
          }}>
            Generated on {new Date().toLocaleDateString()}
          </div>
        </div>
        {config.author && (
          <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
            Prepared by: {config.author}
          </p>
        )}
      </div>

      {/* Table of Contents */}
      <div style={{ marginBottom: '20mm', paddingBottom: '10mm', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <BookOpenIcon style={{ width: '16px', height: '16px', color: '#2563eb', marginRight: '8px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', margin: '0' }}>
            Table of Contents
          </h2>
        </div>
        <div style={{ paddingLeft: '24px' }}>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#2563eb', fontWeight: '500', marginRight: '10px', fontSize: '13px' }}>1.</span>
            <span style={{ color: '#2563eb', fontSize: '13px' }}>Executive Summary</span>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#2563eb', fontWeight: '500', marginRight: '10px', fontSize: '13px' }}>2.</span>
            <span style={{ color: '#2563eb', fontSize: '13px' }}>Test Metrics</span>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#2563eb', fontWeight: '500', marginRight: '10px', fontSize: '13px' }}>3.</span>
            <span style={{ color: '#2563eb', fontSize: '13px' }}>Failed Tests</span>
          </div>
          {config.includeAllTests && (
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: '#2563eb', fontWeight: '500', marginRight: '10px', fontSize: '13px' }}>4.</span>
              <span style={{ color: '#2563eb', fontSize: '13px' }}>All Test Cases</span>
            </div>
          )}
          {config.includeResolutionProgress && (
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: '#2563eb', fontWeight: '500', marginRight: '10px', fontSize: '13px' }}>
                {config.includeAllTests ? '5.' : config.includeFailedTests ? '4.' : '3.'}
              </span>
              <span style={{ color: '#2563eb', fontSize: '13px' }}>Failure Resolution Progress</span>
            </div>
          )}
        </div>
      </div>

      {/* Executive Summary */}
      {config.includeExecutiveSummary && (
        <div style={{ marginBottom: '20mm', paddingBottom: '10mm', borderBottom: '1px solid #e5e7eb', pageBreakInside: 'avoid' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>
            1. Executive Summary
          </h2>
          <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <p style={{ marginBottom: '12px', fontSize: '13px' }}>
              This report provides an overview of the automated test results for {config.projectName || 'the project'}.
              The tests were executed on {new Date().toLocaleDateString()} with a total duration of {formatDuration(summary.time)}.
            </p>

            {/* Test Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10mm', marginBottom: '16px' }}>
              <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '500', color: '#6b7280', margin: '0' }}>Total Tests</h4>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb' }}>{summary.total}</span>
                </div>
              </div>
              <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '500', color: '#6b7280', margin: '0' }}>Pass Rate</h4>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>
                    {(summary.passed / summary.total * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '500', color: '#6b7280', margin: '0' }}>Duration</h4>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#8b5cf6' }}>{formatDuration(summary.time)}</span>
                </div>
              </div>
            </div>

            {/* Failed Tests Summary */}
            {summary.failed > 0 && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '12px'
              }}>
                <h4 style={{ fontSize: '13px', fontWeight: '500', color: '#dc2626', marginBottom: '6px' }}>
                  Failed Tests Summary
                </h4>
                <p style={{ color: '#dc2626', fontSize: '12px', marginBottom: '6px' }}>
                  {summary.failed} test{summary.failed > 1 ? 's' : ''} failed ({(summary.failed / summary.total * 100).toFixed(1)}% of total tests)
                </p>
                <ul style={{ margin: '0', paddingLeft: '18px' }}>
                  {failedTests.slice(0, 5).map((test, index: number) => (
                    <li key={index} style={{ fontSize: '11px', color: '#dc2626', marginBottom: '3px' }}>
                      • {test.name} ({test.suite})
                    </li>
                  ))}
                  {failedTests.length > 5 && (
                    <li style={{ fontSize: '11px', color: '#dc2626', fontStyle: 'italic' }}>
                      ... and {failedTests.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            <p style={{ marginBottom: '0', fontSize: '13px' }}>
              {summary.failed > 0
                ? `There were ${summary.failed} failed tests that require attention. Key areas to focus on include reviewing the failed test cases and addressing the underlying issues.`
                : 'All tests passed successfully. The test suite is performing as expected.'
              }
            </p>
          </div>
        </div>
      )}

      {/* Test Metrics */}
      {config.includeTestMetrics && (
        <div style={{ marginBottom: '20mm', paddingBottom: '10mm', borderBottom: '1px solid #e5e7eb', pageBreakInside: 'avoid' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>
            2. Test Metrics
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20mm' }}>
            {/* Chart */}
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#6b7280', marginBottom: '12px' }}>
                Test Results Distribution
              </h3>
              <div style={{ height: '200px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45} // Increased from 40
                      outerRadius={80} // Increased from 70
                      paddingAngle={1} // Increased from 0 for better separation
                      dataKey="value"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      minAngle={2}
                      stroke="#ffffff" // White stroke for better separation
                      strokeWidth={2}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip active={false} payload={[]} />} />
                    <Legend
                      verticalAlign="bottom"
                      height={30}
                      wrapperStyle={{ fontSize: '11px' }}
                      formatter={(value, entry) => (
                        <span style={{ color: entry.color, fontWeight: '500' }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Summary Table */}
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#6b7280', marginBottom: '12px' }}>
                Test Results Summary
              </h3>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '11px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{
                      padding: '8px 10px',
                      textAlign: 'left',
                      fontWeight: '500',
                      color: '#6b7280',
                      border: '1px solid #e5e7eb'
                    }}>
                      Metric
                    </th>
                    <th style={{
                      padding: '8px 10px',
                      textAlign: 'left',
                      fontWeight: '500',
                      color: '#6b7280',
                      border: '1px solid #e5e7eb'
                    }}>
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px 10px', fontWeight: '500', color: '#1f2937', border: '1px solid #e5e7eb' }}>
                      Total Tests
                    </td>
                    <td style={{ padding: '8px 10px', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                      {summary.total}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 10px', fontWeight: '500', color: '#1f2937', border: '1px solid #e5e7eb' }}>
                      Passed Tests
                    </td>
                    <td style={{ padding: '8px 10px', color: '#059669', fontWeight: '500', border: '1px solid #e5e7eb' }}>
                      {summary.passed} ({(summary.passed / summary.total * 100).toFixed(1)}%)
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 10px', fontWeight: '500', color: '#1f2937', border: '1px solid #e5e7eb' }}>
                      Failed Tests
                    </td>
                    <td style={{ padding: '8px 10px', color: '#dc2626', fontWeight: '500', border: '1px solid #e5e7eb' }}>
                      {summary.failed} ({(summary.failed / summary.total * 100).toFixed(1)}%)
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 10px', fontWeight: '500', color: '#1f2937', border: '1px solid #e5e7eb' }}>
                      Skipped Tests
                    </td>
                    <td style={{ padding: '8px 10px', color: '#d97706', fontWeight: '500', border: '1px solid #e5e7eb' }}>
                      {summary.skipped} ({(summary.skipped / summary.total * 100).toFixed(1)}%)
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 10px', fontWeight: '500', color: '#1f2937', border: '1px solid #e5e7eb' }}>
                      Total Duration
                    </td>
                    <td style={{ padding: '8px 10px', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                      {formatDuration(summary.time)} ({summary.time.toFixed(2)} seconds)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Failed Tests */}
      {config.includeFailedTests && (
        <div style={{ marginBottom: '20mm', paddingBottom: '10mm', borderBottom: '1px solid #e5e7eb', pageBreakInside: 'avoid' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>
            3. Failed Tests
          </h2>
          {failedTests.length > 0 ? (
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '10px',
              backgroundColor: 'white',
              border: '1px solid #e5e7eb'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={{
                    padding: '8px 10px',
                    textAlign: 'left',
                    fontWeight: '500',
                    color: '#6b7280',
                    border: '1px solid #e5e7eb',
                    width: '25%'
                  }}>
                    Test Name
                  </th>
                  <th style={{
                    padding: '8px 10px',
                    textAlign: 'left',
                    fontWeight: '500',
                    color: '#6b7280',
                    border: '1px solid #e5e7eb',
                    width: '20%'
                  }}>
                    Suite
                  </th>
                  <th style={{
                    padding: '8px 10px',
                    textAlign: 'left',
                    fontWeight: '500',
                    color: '#6b7280',
                    border: '1px solid #e5e7eb',
                    width: '10%'
                  }}>
                    Duration
                  </th>
                  <th style={{
                    padding: '8px 10px',
                    textAlign: 'left',
                    fontWeight: '500',
                    color: '#6b7280',
                    border: '1px solid #e5e7eb',
                    width: '45%'
                  }}>
                    Error Message
                  </th>
                </tr>
              </thead>
              <tbody>
                {failedTests.map((test, index: number) => (
                  <tr key={index}>
                    <td style={{
                      padding: '8px 10px',
                      fontWeight: '500',
                      color: '#dc2626',
                      border: '1px solid #e5e7eb',
                      wordWrap: 'break-word',
                      maxWidth: '0'
                    }}>
                      {test.name}
                    </td>
                    <td style={{
                      padding: '8px 10px',
                      color: '#6b7280',
                      border: '1px solid #e5e7eb',
                      wordWrap: 'break-word',
                      maxWidth: '0'
                    }}>
                      {test.suite}
                    </td>
                    <td style={{
                      padding: '8px 10px',
                      color: '#6b7280',
                      border: '1px solid #e5e7eb',
                      whiteSpace: 'nowrap'
                    }}>
                      {test.time.toFixed(2)}s
                    </td>
                    <td style={{
                      padding: '8px 10px',
                      color: '#6b7280',
                      border: '1px solid #e5e7eb',
                      wordWrap: 'break-word',
                      maxWidth: '0'
                    }}>
                      {test.errorMessage || 'No error message provided'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '4px',
              padding: '8px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <CheckIcon style={{ width: '16px', height: '16px', color: '#22c55e', marginRight: '8px' }} />
              <p style={{ color: '#16a34a', margin: '0' }}>
                No failed tests were found. All tests passed successfully!
              </p>
            </div>
          )}
        </div>
      )}

      {/* All Tests */}
      {config.includeAllTests && (
        <div style={{ marginBottom: '20mm', pageBreakInside: 'avoid' }} className="page-break-before">
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>
            {config.includeFailedTests ? '4. All Test Cases' : '3. All Test Cases'}
          </h2>
          {(() => {
            // Get all test cases with intelligent limiting for PDF
            const allTests = testData.suites.flatMap((suite) =>
              suite.testcases.map((test) => ({ ...test, suite: suite.name }))
            );

            // Calculate optimal limit based on content and memory constraints
            const baseLimit = 500; // Conservative base limit
            const totalTests = allTests.length;
            let maxTestsInPDF = baseLimit;

            // Adjust limit based on total test count and available memory
            if (totalTests > 5000) {
              maxTestsInPDF = Math.min(300, totalTests); // Very large datasets
            } else if (totalTests > 2000) {
              maxTestsInPDF = Math.min(400, totalTests); // Large datasets
            } else if (totalTests > 1000) {
              maxTestsInPDF = Math.min(600, totalTests); // Medium datasets
            }

            const testsToShow = allTests.slice(0, maxTestsInPDF);
            const hasMoreTests = allTests.length > maxTestsInPDF;

            return (
              <div>
                {hasMoreTests && (
                  <div style={{
                    backgroundColor: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: '4px',
                    padding: '12px',
                    marginBottom: '16px'
                  }}>
                    <p style={{ color: '#92400e', margin: '0', fontSize: '12px', fontWeight: '500' }}>
                      📄 PDF Optimization: Showing first {maxTestsInPDF} of {allTests.length} total test cases.
                      This ensures optimal PDF performance and file size. For complete results, use the web view or export data.
                    </p>
                  </div>
                )}

                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '10px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      <th style={{
                        padding: '8px 10px',
                        textAlign: 'left',
                        fontWeight: '500',
                        color: '#6b7280',
                        border: '1px solid #e5e7eb',
                        width: '30%'
                      }}>
                        Test Name
                      </th>
                      <th style={{
                        padding: '8px 10px',
                        textAlign: 'left',
                        fontWeight: '500',
                        color: '#6b7280',
                        border: '1px solid #e5e7eb',
                        width: '20%'
                      }}>
                        Suite
                      </th>
                      <th style={{
                        padding: '8px 10px',
                        textAlign: 'left',
                        fontWeight: '500',
                        color: '#6b7280',
                        border: '1px solid #e5e7eb',
                        width: '15%'
                      }}>
                        Status
                      </th>
                      <th style={{
                        padding: '8px 10px',
                        textAlign: 'left',
                        fontWeight: '500',
                        color: '#6b7280',
                        border: '1px solid #e5e7eb',
                        width: '15%'
                      }}>
                        Assignee
                      </th>
                      <th style={{
                        padding: '8px 10px',
                        textAlign: 'left',
                        fontWeight: '500',
                        color: '#6b7280',
                        border: '1px solid #e5e7eb',
                        width: '10%'
                      }}>
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {testsToShow.map((test: TestCase & { suite: string }, testIndex: number) => {
                      // Add page break hints for every 25 rows to help with PDF generation
                      const rowStyle = testIndex > 0 && testIndex % 25 === 0
                        ? { pageBreakBefore: 'auto' as const }
                        : {};

                      return (
                        <tr key={`all-tests-${testIndex}`} style={rowStyle}>
                          <td style={{
                            padding: '6px 8px',
                            fontWeight: '500',
                            color: '#1f2937',
                            border: '1px solid #e5e7eb',
                            wordWrap: 'break-word',
                            maxWidth: '0',
                            fontSize: '10px'
                          }}>
                            {test.name}
                          </td>
                          <td style={{
                            padding: '6px 8px',
                            color: '#6b7280',
                            border: '1px solid #e5e7eb',
                            wordWrap: 'break-word',
                            maxWidth: '0',
                            fontSize: '10px'
                          }}>
                            {test.suite}
                          </td>
                          <td style={{
                            padding: '6px 8px',
                            border: '1px solid #e5e7eb',
                            whiteSpace: 'nowrap',
                            fontSize: '10px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {getStatusIcon(test.status)}
                              <span style={{
                                marginLeft: '4px',
                                color: test.status === 'passed' ? '#059669' : test.status === 'failed' ? '#dc2626' : '#d97706',
                                fontWeight: '500',
                                fontSize: '9px'
                              }}>
                                {test.status === 'passed' ? 'Passed' : test.status === 'failed' ? 'Failed' : 'Skipped'}
                              </span>
                            </div>
                          </td>
                          <td style={{
                            padding: '6px 8px',
                            color: '#6b7280',
                            border: '1px solid #e5e7eb',
                            wordWrap: 'break-word',
                            maxWidth: '0',
                            fontSize: '10px'
                          }}>
                            {(test as TestCase & { assignee?: string }).assignee || 'Unassigned'}
                          </td>
                          <td style={{
                            padding: '6px 8px',
                            color: '#6b7280',
                            border: '1px solid #e5e7eb',
                            whiteSpace: 'nowrap',
                            fontSize: '10px'
                          }}>
                            {test.time.toFixed(2)}s
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* Failure Resolution Progress */}
      {config.includeResolutionProgress && (
        <div style={{ marginBottom: '20mm', pageBreakInside: 'avoid' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>
            {config.includeAllTests ? '5. Failure Resolution Progress' : config.includeFailedTests ? '4. Failure Resolution Progress' : '3. Failure Resolution Progress'}
          </h2>
          {(() => {
            // Access localStorage safely for PDF generation
            let progressData: Record<string, {
              status?: string;
              assignee?: string;
              name?: string;
              suite?: string;
              notes?: string;
            }> = {};
            try {
              const savedProgress = typeof window !== 'undefined' ? localStorage.getItem('testFixProgress') : null;
              progressData = savedProgress ? JSON.parse(savedProgress) : {};
            } catch (e) {
              console.warn('Could not access localStorage in PDF context:', e);
            }

            const failedTests = Object.values(progressData);
            const totalTests = failedTests.length;
            const completedTests = failedTests.filter(test => test.status === 'completed').length;
            const inProgressTests = failedTests.filter(test => test.status === 'in_progress').length;

            return (
              <div>
                {/* Progress Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10mm', marginBottom: '16px' }}>
                  <div style={{ backgroundColor: '#f9fafb', padding: '12px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>Total Failed Tests</span>
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>{totalTests}</span>
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#059669' }}>Completed</span>
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#047857' }}>{completedTests}</span>
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#2563eb' }}>In Progress</span>
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1d4ed8' }}>{inProgressTests}</span>
                    </div>
                  </div>
                </div>

                {/* Progress Table */}
                {totalTests > 0 ? (
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '10px',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <th style={{
                          padding: '8px 10px',
                          textAlign: 'left',
                          fontWeight: '500',
                          color: '#6b7280',
                          border: '1px solid #e5e7eb',
                          width: '25%'
                        }}>
                          Test Name
                        </th>
                        <th style={{
                          padding: '8px 10px',
                          textAlign: 'left',
                          fontWeight: '500',
                          color: '#6b7280',
                          border: '1px solid #e5e7eb',
                          width: '20%'
                        }}>
                          Suite
                        </th>
                        <th style={{
                          padding: '8px 10px',
                          textAlign: 'left',
                          fontWeight: '500',
                          color: '#6b7280',
                          border: '1px solid #e5e7eb',
                          width: '15%'
                        }}>
                          Status
                        </th>
                        <th style={{
                          padding: '8px 10px',
                          textAlign: 'left',
                          fontWeight: '500',
                          color: '#6b7280',
                          border: '1px solid #e5e7eb',
                          width: '15%'
                        }}>
                          Assignee
                        </th>
                        <th style={{
                          padding: '8px 10px',
                          textAlign: 'left',
                          fontWeight: '500',
                          color: '#6b7280',
                          border: '1px solid #e5e7eb',
                          width: '25%'
                        }}>
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {failedTests.map((test, index: number) => (
                        <tr key={index}>
                          <td style={{
                            padding: '8px 10px',
                            fontWeight: '500',
                            color: '#1f2937',
                            border: '1px solid #e5e7eb',
                            wordWrap: 'break-word',
                            maxWidth: '0'
                          }}>
                            {test.name}
                          </td>
                          <td style={{
                            padding: '8px 10px',
                            color: '#6b7280',
                            border: '1px solid #e5e7eb',
                            wordWrap: 'break-word',
                            maxWidth: '0'
                          }}>
                            {test.suite}
                          </td>
                          <td style={{
                            padding: '8px 10px',
                            border: '1px solid #e5e7eb',
                            whiteSpace: 'nowrap'
                          }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: '12px',
                              fontSize: '9px',
                              fontWeight: '500',
                              backgroundColor: test.status === 'completed' ? '#d1fae5' : test.status === 'in_progress' ? '#dbeafe' : '#fee2e2',
                              color: test.status === 'completed' ? '#065f46' : test.status === 'in_progress' ? '#1e40af' : '#991b1b'
                            }}>
                              {test.status ? test.status.replace('_', ' ').charAt(0).toUpperCase() + test.status.slice(1) : 'Not Started'}
                            </span>
                          </td>
                          <td style={{
                            padding: '8px 10px',
                            color: '#6b7280',
                            border: '1px solid #e5e7eb',
                            wordWrap: 'break-word',
                            maxWidth: '0'
                          }}>
                            {test.assignee || '-'}
                          </td>
                          <td style={{
                            padding: '8px 10px',
                            color: '#6b7280',
                            border: '1px solid #e5e7eb',
                            wordWrap: 'break-word',
                            maxWidth: '0'
                          }}>
                            {test.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '12px',
                    textAlign: 'center'
                  }}>
                    <p style={{ color: '#6b7280', margin: '0', fontSize: '12px' }}>
                      No failure resolution progress data available.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};