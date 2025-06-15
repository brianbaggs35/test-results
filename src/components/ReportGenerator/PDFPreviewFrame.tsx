import React from 'react';
import { BookOpenIcon, CheckIcon, XIcon, AlertCircleIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatDuration } from '../../utils/formatting';

export const PDFPreviewFrame = ({ testData, config }: { testData: any; config: any }) => {
  const { summary } = testData;

  const statusData = [
    { name: 'Passed', value: summary.passed, color: '#10B981' },
    { name: 'Failed', value: summary.failed, color: '#EF4444' },
    { name: 'Skipped', value: summary.skipped, color: '#F59E0B' }
  ];

  const failedTests = testData.suites.flatMap((suite: any) =>
    suite.testcases
      .filter((test: any) => test.status === 'failed')
      .map((test: any) => ({ ...test, suite: suite.name }))
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

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }: any) => {
    if (percent < 0.02) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.8; // Moved labels slightly outward
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

  const CustomTooltip = ({ active, payload }: any) => {
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
      id="pdf-preview-frame" 
      className="pdf-frame"
      style={{
        width: '210mm',
        minHeight: '297mm',
        backgroundColor: 'white',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '12px', // Increased from 11px
        lineHeight: '1.5', // Increased from 1.4 for better readability
        color: '#374151',
        padding: '15mm', // Increased from 10mm for better margins
        margin: '0',
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
        <div style={{ textAlign: 'center', marginBottom: '20px' }}> // Increased spacing
          <div style={{ 
            backgroundColor: '#dbeafe', 
            color: '#1e40af', 
            padding: '10px 20px', // Increased padding
            borderRadius: '20px', 
            display: 'inline-block',
            fontSize: '13px' // Increased font size
          }}>
            Generated on {new Date().toLocaleDateString()}
          </div>
        </div>
        {config.author && (
          <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '13px' }}> // Increased font size
            Prepared by: {config.author}
          </p>
        )}
      </div>

      {/* Table of Contents */}
      <div style={{ marginBottom: '20mm', paddingBottom: '10mm', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <BookOpenIcon style={{ width: '16px', height: '16px', color: '#2563eb', marginRight: '8px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', margin: '0' }}> // Increased from 18px
            Table of Contents
          </h2>
        </div>
        <div style={{ paddingLeft: '24px' }}>
          <div style={{ marginBottom: '8px' }}> // Increased spacing
            <span style={{ color: '#2563eb', fontWeight: '500', marginRight: '10px', fontSize: '13px' }}>1.</span> // Increased font
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
        </div>
      </div>

      {/* Executive Summary */}
      {config.includeExecutiveSummary && (
        <div style={{ marginBottom: '20mm', paddingBottom: '10mm', borderBottom: '1px solid #e5e7eb', pageBreakInside: 'avoid' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}> // Increased from 18px
            1. Executive Summary
          </h2>
          <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px' }}> // Increased padding and border radius
            <p style={{ marginBottom: '12px', fontSize: '13px' }}> // Increased font size and spacing
              This report provides an overview of the automated test results for {config.projectName || 'the project'}. 
              The tests were executed on {new Date().toLocaleDateString()} with a total duration of {formatDuration(summary.time)}.
            </p>
            
            {/* Test Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10mm', marginBottom: '16px' }}> // Increased gap and margin
              <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}> // Increased padding
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '500', color: '#6b7280', margin: '0' }}>Total Tests</h4> // Increased font
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb' }}>{summary.total}</span> // Increased font
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
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#8b5cf6' }}>{formatDuration(summary.time)}</span> // Increased font
                </div>
              </div>
            </div>

            {/* Failed Tests Summary */}
            {summary.failed > 0 && (
              <div style={{ 
                backgroundColor: '#fef2f2', 
                border: '1px solid #fecaca', 
                borderRadius: '6px', // Increased from 4px
                padding: '12px', // Increased from 8px
                marginBottom: '12px' // Increased from 8px
              }}>
                <h4 style={{ fontSize: '13px', fontWeight: '500', color: '#dc2626', marginBottom: '6px' }}> // Increased font and spacing
                  Failed Tests Summary
                </h4>
                <p style={{ color: '#dc2626', fontSize: '12px', marginBottom: '6px' }}> // Increased font and spacing
                  {summary.failed} test{summary.failed > 1 ? 's' : ''} failed ({(summary.failed / summary.total * 100).toFixed(1)}% of total tests)
                </p>
                <ul style={{ margin: '0', paddingLeft: '18px' }}> // Increased padding
                  {failedTests.slice(0, 5).map((test: any, index: number) => (
                    <li key={index} style={{ fontSize: '11px', color: '#dc2626', marginBottom: '3px' }}> // Increased font and spacing
                      • {test.name} ({test.suite})
                    </li>
                  ))}
                  {failedTests.length > 5 && (
                    <li style={{ fontSize: '11px', color: '#dc2626', fontStyle: 'italic' }}> // Increased font
                      ... and {failedTests.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            <p style={{ marginBottom: '0', fontSize: '13px' }}> // Increased font size
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
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}> // Increased from 18px
            2. Test Metrics
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20mm' }}> // Increased gap
            {/* Chart */}
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#6b7280', marginBottom: '12px' }}> // Increased font and spacing
                Test Results Distribution
              </h3>
              <div style={{ height: '180px', width: '100%' }}> // Increased height
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
                      height={30} // Increased from 24
                      wrapperStyle={{ fontSize: '11px' }} // Increased from 10px
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
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#6b7280', marginBottom: '12px' }}> // Increased font and spacing
                Test Results Summary
              </h3>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                fontSize: '11px', // Increased from 10px
                backgroundColor: 'white',
                border: '1px solid #e5e7eb'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{ 
                      padding: '8px 10px', // Increased padding
                      textAlign: 'left', 
                      fontWeight: '500', 
                      color: '#6b7280',
                      border: '1px solid #e5e7eb'
                    }}>
                      Metric
                    </th>
                    <th style={{ 
                      padding: '8px 10px', // Increased padding
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
                    <td style={{ padding: '8px 10px', fontWeight: '500', color: '#1f2937', border: '1px solid #e5e7eb' }}> // Increased padding
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
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}> // Increased from 18px
            3. Failed Tests
          </h2>
          {failedTests.length > 0 ? (
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              fontSize: '10px', // Increased from 9px
              backgroundColor: 'white',
              border: '1px solid #e5e7eb'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={{ 
                    padding: '8px 10px', // Increased padding
                    textAlign: 'left', 
                    fontWeight: '500', 
                    color: '#6b7280',
                    border: '1px solid #e5e7eb',
                    width: '25%'
                  }}>
                    Test Name
                  </th>
                  <th style={{ 
                    padding: '8px 10px', // Increased padding
                    textAlign: 'left', 
                    fontWeight: '500', 
                    color: '#6b7280',
                    border: '1px solid #e5e7eb',
                    width: '20%'
                  }}>
                    Suite
                  </th>
                  <th style={{ 
                    padding: '8px 10px', // Increased padding
                    textAlign: 'left', 
                    fontWeight: '500', 
                    color: '#6b7280',
                    border: '1px solid #e5e7eb',
                    width: '10%'
                  }}>
                    Duration
                  </th>
                  <th style={{ 
                    padding: '8px 10px', // Increased padding
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
                {failedTests.map((test: any, index: number) => (
                  <tr key={index}>
                    <td style={{ 
                      padding: '8px 10px', // Increased padding
                      fontWeight: '500', 
                      color: '#dc2626', 
                      border: '1px solid #e5e7eb',
                      wordWrap: 'break-word',
                      maxWidth: '0'
                    }}>
                      {test.name}
                    </td>
                    <td style={{ 
                      padding: '8px 10px', // Increased padding
                      color: '#6b7280', 
                      border: '1px solid #e5e7eb',
                      wordWrap: 'break-word',
                      maxWidth: '0'
                    }}>
                      {test.suite}
                    </td>
                    <td style={{ 
                      padding: '8px 10px', // Increased padding
                      color: '#6b7280', 
                      border: '1px solid #e5e7eb',
                      whiteSpace: 'nowrap'
                    }}>
                      {parseFloat(test.time).toFixed(2)}s
                    </td>
                    <td style={{ 
                      padding: '8px 10px', // Increased padding
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
        <div style={{ marginBottom: '20mm', pageBreakInside: 'avoid' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}> // Increased from 18px
            {config.includeFailedTests ? '4. All Test Cases' : '3. All Test Cases'}
          </h2>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            fontSize: '10px', // Increased from 9px
            backgroundColor: 'white',
            border: '1px solid #e5e7eb'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <th style={{ 
                  padding: '8px 10px', // Increased padding
                  textAlign: 'left', 
                  fontWeight: '500', 
                  color: '#6b7280',
                  border: '1px solid #e5e7eb',
                  width: '30%'
                }}>
                  Test Name
                </th>
                <th style={{ 
                  padding: '8px 10px', // Increased padding
                  textAlign: 'left', 
                  fontWeight: '500', 
                  color: '#6b7280',
                  border: '1px solid #e5e7eb',
                  width: '20%'
                }}>
                  Suite
                </th>
                <th style={{ 
                  padding: '8px 10px', // Increased padding
                  textAlign: 'left', 
                  fontWeight: '500', 
                  color: '#6b7280',
                  border: '1px solid #e5e7eb',
                  width: '15%'
                }}>
                  Status
                </th>
                <th style={{ 
                  padding: '8px 10px', // Increased padding
                  textAlign: 'left', 
                  fontWeight: '500', 
                  color: '#6b7280',
                  border: '1px solid #e5e7eb',
                  width: '15%'
                }}>
                  Assignee
                </th>
                <th style={{ 
                  padding: '8px 10px', // Increased padding
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
              {testData.suites.flatMap((suite: any) =>
                suite.testcases.map((test: any, testIndex: number) => (
                  <tr key={`${suite.name}-${testIndex}`}>
                    <td style={{ 
                      padding: '8px 10px', // Increased padding
                      fontWeight: '500', 
                      color: '#1f2937', 
                      border: '1px solid #e5e7eb',
                      wordWrap: 'break-word',
                      maxWidth: '0'
                    }}>
                      {test.name}
                    </td>
                    <td style={{ 
                      padding: '8px 10px', // Increased padding
                      color: '#6b7280', 
                      border: '1px solid #e5e7eb',
                      wordWrap: 'break-word',
                      maxWidth: '0'
                    }}>
                      {suite.name}
                    </td>
                    <td style={{ 
                      padding: '8px 10px', // Increased padding
                      border: '1px solid #e5e7eb',
                      whiteSpace: 'nowrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {getStatusIcon(test.status)}
                        <span style={{ 
                          marginLeft: '4px', 
                          color: test.status === 'passed' ? '#059669' : test.status === 'failed' ? '#dc2626' : '#d97706',
                          fontWeight: '500',
                          fontSize: '10px' // Increased from 9px
                        }}>
                          {test.status === 'passed' ? 'Passed' : test.status === 'failed' ? 'Failed' : 'Skipped'}
                        </span>
                      </div>
                    </td>
                    <td style={{ 
                      padding: '8px 10px', // Increased padding
                      color: '#6b7280', 
                      border: '1px solid #e5e7eb',
                      wordWrap: 'break-word',
                      maxWidth: '0'
                    }}>
                      {test.assignee || 'Unassigned'}
                    </td>
                    <td style={{ 
                      padding: '8px 10px', // Increased padding
                      color: '#6b7280', 
                      border: '1px solid #e5e7eb',
                      whiteSpace: 'nowrap'
                    }}>
                      {parseFloat(test.time).toFixed(2)}s
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};