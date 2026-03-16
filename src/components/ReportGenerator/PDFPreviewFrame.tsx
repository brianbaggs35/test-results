import { BookOpenIcon, CheckIcon, XIcon, AlertCircleIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatDuration } from '../../utils/formatting';
import { TestData, ReportConfig, TestCase } from '../../types';
import { useChartRenderComplete } from '../../hooks/useChartRenderComplete';

interface PDFPreviewFrameProps {
  testData: TestData;
  config: ReportConfig;
}

// A4 at 96 DPI = 794 x 1123 px
const A4_WIDTH = 794;

const sectionStyle: React.CSSProperties = {
  marginBottom: '28px',
  paddingBottom: '20px',
  borderBottom: '2px solid #e5e7eb',
  pageBreakInside: 'avoid',
};

const headingStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '700',
  color: '#111827',
  marginBottom: '14px',
  marginTop: '0',
  paddingBottom: '6px',
  borderBottom: '2px solid #2563eb',
  display: 'inline-block',
  pageBreakAfter: 'avoid',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '10px',
  backgroundColor: 'white',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  overflow: 'hidden',
};

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  fontWeight: '600',
  color: '#374151',
  backgroundColor: '#f3f4f6',
  borderBottom: '2px solid #d1d5db',
  borderRight: '1px solid #e5e7eb',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '7px 10px',
  color: '#374151',
  borderBottom: '1px solid #e5e7eb',
  borderRight: '1px solid #f3f4f6',
  wordWrap: 'break-word',
  fontSize: '10px',
};

const zebraRow = (i: number): React.CSSProperties => ({
  backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb',
});

export const PDFPreviewFrame = ({ testData, config }: PDFPreviewFrameProps) => {
  const { summary } = testData;

  useChartRenderComplete([testData]);

  const statusData = [
    { name: 'Passed', value: summary.passed, color: '#10B981' },
    { name: 'Failed', value: summary.failed, color: '#EF4444' },
    { name: 'Skipped', value: summary.skipped, color: '#F59E0B' },
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

  const renderCustomizedLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent, value,
  }: {
    cx: number; cy: number; midAngle: number;
    innerRadius: number; outerRadius: number;
    percent: number; value: number;
  }) => {
    if (percent < 0.02) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const label = `${value} (${(percent * 100).toFixed(0)}%)`;
    return (
      <g>
        {/* White outline for readability on all segment colors */}
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: '10px', fontWeight: '700' }}
          stroke="#ffffff" strokeWidth={3} fill="#ffffff">
          {label}
        </text>
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: '10px', fontWeight: '700' }}
          fill="#1f2937">
          {label}
        </text>
      </g>
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
          <p className="text-gray-500">
            {summary.total > 0 ? (data.value / summary.total * 100).toFixed(1) : '0.0'}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  // Dynamic section numbering
  let sectionNum = 0;
  const nextSection = () => ++sectionNum;
  const execSummaryNum = config.includeExecutiveSummary ? nextSection() : 0;
  const metricsNum = config.includeTestMetrics ? nextSection() : 0;
  const failedTestsNum = config.includeFailedTests ? nextSection() : 0;
  const allTestsNum = config.includeAllTests ? nextSection() : 0;
  const resolutionNum = config.includeResolutionProgress ? nextSection() : 0;

  // Shared horizontal padding for all content sections below the title
  const contentPad: React.CSSProperties = { paddingLeft: '40px', paddingRight: '40px' };

  return (
    <div
      id="report-preview"
      className="pdf-content"
      style={{
        width: `${A4_WIDTH}px`,
        minHeight: '1123px',
        backgroundColor: 'white',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '12px',
        lineHeight: '1.6',
        color: '#374151',
        padding: '0',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Title – no negative margins; sits flush at the top of the zero-padded root */}
      <div style={{
        textAlign: 'center',
        borderBottom: '3px solid #2563eb',
        marginBottom: '32px',
        background: 'linear-gradient(180deg, #eff6ff 0%, white 100%)',
        padding: '36px 40px 28px 40px',
      }}>
        <h1 style={{
          fontSize: '26px', fontWeight: '800', color: '#111827',
          marginBottom: '6px', marginTop: '0', letterSpacing: '-0.02em',
          borderBottom: 'none', display: 'block',
        }}>
          {config.title}
        </h1>
        {config.projectName && (
          <h2 style={{
            fontSize: '15px', fontWeight: '500', color: '#6b7280',
            marginBottom: '16px', marginTop: '0',
          }}>
            {config.projectName}
          </h2>
        )}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '16px',
          alignItems: 'center', flexWrap: 'wrap',
        }}>
          <div style={{
            backgroundColor: '#dbeafe', color: '#1e40af',
            padding: '5px 14px', borderRadius: '16px',
            fontSize: '11px', fontWeight: '500',
          }}>
            Generated on {new Date().toLocaleDateString()}
          </div>
          {config.author && (
            <div style={{
              backgroundColor: '#f3f4f6', color: '#4b5563',
              padding: '5px 14px', borderRadius: '16px',
              fontSize: '11px', fontWeight: '500',
            }}>
              Prepared by: {config.author}
            </div>
          )}
        </div>
      </div>

      {/* Table of Contents */}
      <div style={{ ...sectionStyle, marginBottom: '32px', ...contentPad }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <BookOpenIcon style={{ width: '14px', height: '14px', color: '#2563eb', marginRight: '8px' }} />
          <h2 style={{ ...headingStyle, marginBottom: '0', fontSize: '15px', borderBottom: 'none', display: 'inline' }}>
            Table of Contents
          </h2>
        </div>
        <div style={{
          backgroundColor: '#f9fafb', borderRadius: '6px', padding: '14px 20px',
          border: '1px solid #e5e7eb',
        }}>
          {config.includeExecutiveSummary && (
            <div style={{ marginBottom: '6px', fontSize: '12px', color: '#2563eb', fontWeight: '500' }}>
              {execSummaryNum}. Executive Summary
            </div>
          )}
          {config.includeTestMetrics && (
            <div style={{ marginBottom: '6px', fontSize: '12px', color: '#2563eb', fontWeight: '500' }}>
              {metricsNum}. Test Metrics
            </div>
          )}
          {config.includeFailedTests && (
            <div style={{ marginBottom: '6px', fontSize: '12px', color: '#2563eb', fontWeight: '500' }}>
              {failedTestsNum}. Failed Tests
            </div>
          )}
          {config.includeAllTests && (
            <div style={{ marginBottom: '6px', fontSize: '12px', color: '#2563eb', fontWeight: '500' }}>
              {allTestsNum}. All Test Cases
            </div>
          )}
          {config.includeResolutionProgress && (
            <div style={{ marginBottom: '0', fontSize: '12px', color: '#2563eb', fontWeight: '500' }}>
              {resolutionNum}. Failure Resolution Progress
            </div>
          )}
        </div>
      </div>

      {/* Executive Summary */}
      {config.includeExecutiveSummary && (
        <div style={{ ...sectionStyle, ...contentPad }} className="avoid-break">
          <h2 style={headingStyle}>{execSummaryNum}. Executive Summary</h2>
          <div style={{ backgroundColor: '#f9fafb', padding: '18px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <p style={{ marginBottom: '14px', fontSize: '12px', marginTop: '0', lineHeight: '1.6', color: '#4b5563' }}>
              This report provides an overview of the automated test results for{' '}
              <strong>{config.projectName || 'the project'}</strong>. The tests were executed on{' '}
              {new Date().toLocaleDateString()} with a total duration of <strong>{formatDuration(summary.time)}</strong>.
            </p>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                backgroundColor: 'white', padding: '12px 14px', borderRadius: '8px',
                border: '1px solid #dbeafe', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Tests</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#2563eb' }}>{summary.total}</div>
              </div>
              <div style={{
                backgroundColor: 'white', padding: '12px 14px', borderRadius: '8px',
                border: '1px solid #d1fae5', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pass Rate</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#10b981' }}>
                  {summary.total > 0 ? (summary.passed / summary.total * 100).toFixed(1) : '0.0'}%
                </div>
              </div>
              <div style={{
                backgroundColor: 'white', padding: '12px 14px', borderRadius: '8px',
                border: '1px solid #ede9fe', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#7c3aed' }}>{formatDuration(summary.time)}</div>
              </div>
            </div>

            {summary.failed > 0 && (
              <div style={{
                backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '6px', padding: '10px', marginBottom: '8px',
              }}>
                <p style={{ color: '#dc2626', fontSize: '11px', fontWeight: '500', marginTop: '0', marginBottom: '4px' }}>
                  {summary.failed} test{summary.failed > 1 ? 's' : ''} failed
                  ({summary.total > 0 ? (summary.failed / summary.total * 100).toFixed(1) : '0.0'}% of total)
                </p>
                <ul style={{ margin: '0', paddingLeft: '16px' }}>
                  {failedTests.slice(0, 5).map((test, i) => (
                    <li key={`fail-summary-${i}`} style={{ fontSize: '10px', color: '#dc2626', marginBottom: '2px' }}>
                      {test.name} ({test.suite})
                    </li>
                  ))}
                  {failedTests.length > 5 && (
                    <li style={{ fontSize: '10px', color: '#dc2626', fontStyle: 'italic' }}>
                      ... and {failedTests.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            <p style={{ marginBottom: '0', fontSize: '12px', marginTop: '0' }}>
              {summary.failed > 0
                ? `There were ${summary.failed} failed tests that require attention.`
                : 'All tests passed successfully.'}
            </p>
          </div>
        </div>
      )}

      {/* Test Metrics */}
      {config.includeTestMetrics && (
        <div style={{ ...sectionStyle, ...contentPad }} className="avoid-break">
          <h2 style={headingStyle}>{metricsNum}. Test Metrics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
            <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '14px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563', marginBottom: '10px', marginTop: '0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Test Results Distribution
              </h3>
              <div style={{ height: '220px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="42%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      minAngle={2}
                      stroke="#ffffff"
                      strokeWidth={2}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={28}
                      wrapperStyle={{ fontSize: '10px' }}
                      formatter={(value, entry) => (
                        <span style={{ color: entry.color, fontWeight: '500' }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563', marginBottom: '10px', marginTop: '0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Test Results Summary
              </h3>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Metric</th>
                    <th style={thStyle}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={zebraRow(0)}>
                    <td style={{ ...tdStyle, fontWeight: '500' }}>Total Tests</td>
                    <td style={{ ...tdStyle, fontWeight: '600' }}>{summary.total}</td>
                  </tr>
                  <tr style={zebraRow(1)}>
                    <td style={{ ...tdStyle, fontWeight: '500' }}>Passed</td>
                    <td style={{ ...tdStyle, color: '#059669', fontWeight: '600' }}>
                      {summary.passed} ({summary.total > 0 ? (summary.passed / summary.total * 100).toFixed(1) : '0.0'}%)
                    </td>
                  </tr>
                  <tr style={zebraRow(2)}>
                    <td style={{ ...tdStyle, fontWeight: '500' }}>Failed</td>
                    <td style={{ ...tdStyle, color: '#dc2626', fontWeight: '600' }}>
                      {summary.failed} ({summary.total > 0 ? (summary.failed / summary.total * 100).toFixed(1) : '0.0'}%)
                    </td>
                  </tr>
                  <tr style={zebraRow(3)}>
                    <td style={{ ...tdStyle, fontWeight: '500' }}>Skipped</td>
                    <td style={{ ...tdStyle, color: '#d97706', fontWeight: '600' }}>
                      {summary.skipped} ({summary.total > 0 ? (summary.skipped / summary.total * 100).toFixed(1) : '0.0'}%)
                    </td>
                  </tr>
                  <tr style={zebraRow(4)}>
                    <td style={{ ...tdStyle, fontWeight: '500' }}>Duration</td>
                    <td style={{ ...tdStyle, fontWeight: '600' }}>{formatDuration(summary.time)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Failed Tests */}
      {config.includeFailedTests && (
        <div style={{ ...sectionStyle, ...contentPad }} className="avoid-break">
          <h2 style={headingStyle}>{failedTestsNum}. Failed Tests</h2>
          {failedTests.length > 0 ? (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: '50%' }}>Test Name</th>
                  <th style={{ ...thStyle, width: '30%' }}>Suite</th>
                  <th style={{ ...thStyle, width: '20%' }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {failedTests.map((test, i) => (
                  <tr key={`failed-${i}`} style={zebraRow(i)}>
                    <td style={{ ...tdStyle, color: '#dc2626', fontWeight: '500' }}>{test.name}</td>
                    <td style={tdStyle}>{test.suite}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{test.time.toFixed(2)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{
              backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: '6px', padding: '10px',
              display: 'flex', alignItems: 'center',
            }}>
              <CheckIcon style={{ width: '14px', height: '14px', color: '#22c55e', marginRight: '6px' }} />
              <span style={{ color: '#16a34a', fontSize: '12px' }}>
                All tests passed successfully!
              </span>
            </div>
          )}
        </div>
      )}

      {/* All Tests */}
      {config.includeAllTests && (
        <div style={{ ...sectionStyle, ...contentPad }} className="page-break-before">
          <h2 style={headingStyle}>{allTestsNum}. All Test Cases</h2>
          {(() => {
            const allTests = testData.suites.flatMap((suite) =>
              suite.testcases.map((test) => ({ ...test, suite: suite.name }))
            );

            const maxTests = allTests.length > 5000 ? 300
              : allTests.length > 2000 ? 400
              : allTests.length > 1000 ? 600 : 500;

            const testsToShow = allTests.slice(0, maxTests);
            const hasMore = allTests.length > maxTests;

            return (
              <div>
                {hasMore && (
                  <div style={{
                    backgroundColor: '#fef3c7', border: '1px solid #f59e0b',
                    borderRadius: '4px', padding: '8px', marginBottom: '12px',
                  }}>
                    <p style={{ color: '#92400e', margin: '0', fontSize: '11px', fontWeight: '500' }}>
                      Showing first {maxTests} of {allTests.length} total test cases for PDF optimization.
                    </p>
                  </div>
                )}
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: '35%' }}>Test Name</th>
                      <th style={{ ...thStyle, width: '25%' }}>Suite</th>
                      <th style={{ ...thStyle, width: '20%' }}>Status</th>
                      <th style={{ ...thStyle, width: '20%' }}>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testsToShow.map((test: TestCase & { suite: string }, i: number) => (
                      <tr key={`all-${i}`} style={zebraRow(i)}>
                        <td style={{ ...tdStyle, fontWeight: '500' }}>{test.name}</td>
                        <td style={tdStyle}>{test.suite}</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {getStatusIcon(test.status)}
                            <span style={{
                              marginLeft: '4px',
                              color: test.status === 'passed' ? '#059669' : test.status === 'failed' ? '#dc2626' : '#d97706',
                              fontWeight: '500',
                            }}>
                              {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                            </span>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{test.time.toFixed(2)}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* Failure Resolution Progress */}
      {config.includeResolutionProgress && (
        <div style={{ ...sectionStyle, borderBottom: 'none', ...contentPad }} className="avoid-break">
          <h2 style={headingStyle}>{resolutionNum}. Failure Resolution Progress</h2>
          {(() => {
            let progressData: Record<string, {
              status?: string; assignee?: string;
              name?: string; suite?: string; notes?: string;
            }> = {};
            try {
              const saved = typeof window !== 'undefined' ? localStorage.getItem('testFixProgress') : null;
              progressData = saved ? JSON.parse(saved) : {};
            } catch (e) {
              console.warn('Could not access localStorage:', e);
            }

            const progressTests = Object.values(progressData);
            const completed = progressTests.filter((t) => t.status === 'completed').length;
            const inProgress = progressTests.filter((t) => t.status === 'in_progress').length;

            return (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '14px' }}>
                  <div style={{
                    backgroundColor: '#f9fafb', padding: '12px 14px', borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}>
                    <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#1f2937' }}>{progressTests.length}</div>
                  </div>
                  <div style={{
                    backgroundColor: '#f0fdf4', padding: '12px 14px', borderRadius: '8px',
                    border: '1px solid #bbf7d0',
                  }}>
                    <div style={{ fontSize: '10px', color: '#059669', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#047857' }}>{completed}</div>
                  </div>
                  <div style={{
                    backgroundColor: '#eff6ff', padding: '12px 14px', borderRadius: '8px',
                    border: '1px solid #bfdbfe',
                  }}>
                    <div style={{ fontSize: '10px', color: '#2563eb', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>In Progress</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d4ed8' }}>{inProgress}</div>
                  </div>
                </div>

                {progressTests.length > 0 ? (
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, width: '25%' }}>Test Name</th>
                        <th style={{ ...thStyle, width: '20%' }}>Suite</th>
                        <th style={{ ...thStyle, width: '15%' }}>Status</th>
                        <th style={{ ...thStyle, width: '15%' }}>Assignee</th>
                        <th style={{ ...thStyle, width: '25%' }}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressTests.map((test, i) => (
                        <tr key={`progress-${i}`} style={zebraRow(i)}>
                          <td style={{ ...tdStyle, fontWeight: '500' }}>{test.name}</td>
                          <td style={tdStyle}>{test.suite}</td>
                          <td style={{ ...tdStyle, verticalAlign: 'middle' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '0px 8px 7px 8px',
                              borderRadius: '10px', fontSize: '9px', fontWeight: '600',
                              lineHeight: '1.2',
                              verticalAlign: 'middle',
                              textAlign: 'center',
                              backgroundColor: test.status === 'completed' ? '#d1fae5' : test.status === 'in_progress' ? '#dbeafe' : '#fee2e2',
                              color: test.status === 'completed' ? '#065f46' : test.status === 'in_progress' ? '#1e40af' : '#991b1b',
                            }}>
                              {test.status ? test.status.replace('_', ' ') : 'Not started'}
                            </span>
                          </td>
                          <td style={tdStyle}>{test.assignee || '-'}</td>
                          <td style={tdStyle}>{test.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{
                    backgroundColor: '#f3f4f6', border: '1px solid #d1d5db',
                    borderRadius: '6px', padding: '14px', textAlign: 'center',
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

      {/* Footer */}
      <div style={{
        marginTop: '32px', paddingTop: '16px',
        borderTop: '2px solid #e5e7eb',
        textAlign: 'center', fontSize: '10px', color: '#9ca3af',
        ...contentPad, paddingBottom: '32px',
      }}>
        <p style={{ margin: '0 0 4px 0' }}>
          {config.title} &mdash; {config.projectName || 'Test Results Report'}
        </p>
        <p style={{ margin: '0' }}>
          Generated on {new Date().toLocaleDateString()} {config.author ? `by ${config.author}` : ''}
        </p>
      </div>
    </div>
  );
};
