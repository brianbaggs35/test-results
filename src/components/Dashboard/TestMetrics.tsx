import { useEffect } from 'react';
import { PieChart, Pie, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';
import { CheckCircleIcon, XCircleIcon, ClockIcon, AlertTriangleIcon } from 'lucide-react';
import { formatDuration } from '../../utils/formatting';
import type { TestData } from '../../types';

interface TestMetricsProps {
  testData: TestData;
}

export const TestMetrics: React.FC<TestMetricsProps> = ({
  testData
}) => {
  const { summary } = testData;
  
  // Add chart-render-complete class after component mounts for PDF generation
  useEffect(() => {
    const timer = setTimeout(() => {
      // Add the class to indicate charts have rendered
      const chartContainer = document.querySelector('.recharts-responsive-container');
      if (chartContainer && !document.querySelector('.chart-render-complete')) {
        const indicator = document.createElement('div');
        indicator.className = 'chart-render-complete';
        indicator.style.display = 'none';
        document.body.appendChild(indicator);
      }
    }, 100); // Small delay to ensure chart has rendered
    
    return () => clearTimeout(timer);
  }, [testData]);
  
  // Prepare test distribution data
  const statusData = [{
    name: 'Passed',
    value: summary.passed,
    color: '#22C55E',
    description: `${summary.passed} tests passed successfully`
  }, {
    name: 'Failed',
    value: summary.failed,
    color: '#DC2626',
    description: `${summary.failed} tests failed`
  }, {
    name: 'Skipped',
    value: summary.skipped,
    color: '#FBBF24',
    description: `${summary.skipped} tests were skipped`
  }];
  const CustomTooltip = ({
    active,
    payload
  }: {
    active?: boolean;
    payload?: Array<{
      payload: {
        name: string;
        value: number;
        description: string;
      };
    }>;
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-medium text-gray-900">{data.name}</p>
          <p className="text-gray-600">{data.description}</p>
          <p className="text-sm text-gray-500 mt-1">
            {(data.value / summary.total * 100).toFixed(1)}% of total
          </p>
        </div>;
    }
    return null;
  };
  // Modify renderCustomizedLabel to handle small segments better
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    value
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
    value: number;
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
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow col-span-1">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">
          Test Execution Summary
        </h3>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-center">
              <CheckCircleIcon className="w-6 h-6 text-green-500 mr-2" />
              <span className="text-2xl font-bold text-green-700">
                {summary.passed}
              </span>
            </div>
            <p className="text-sm text-green-600 text-center mt-2">Passed</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center justify-center">
              <XCircleIcon className="w-6 h-6 text-red-500 mr-2" />
              <span className="text-2xl font-bold text-red-700">
                {summary.failed}
              </span>
            </div>
            <p className="text-sm text-red-600 text-center mt-2">Failed</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center justify-center">
              <AlertTriangleIcon className="w-6 h-6 text-yellow-500 mr-2" />
              <span className="text-2xl font-bold text-yellow-700">
                {summary.skipped}
              </span>
            </div>
            <p className="text-sm text-yellow-600 text-center mt-2">Skipped</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="flex items-center">
              <ClockIcon className="w-5 h-5 text-blue-500 mr-2" />
              <span className="font-medium text-gray-700">Total Duration:</span>
            </div>
            <p className="text-lg font-bold text-blue-600 mt-1">
              {formatDuration(summary.time)}
            </p>
          </div>
          <div>
            <div className="flex items-center">
              <span className="font-medium text-gray-700">Success Rate:</span>
            </div>
            <p className="text-lg font-bold text-blue-600 mt-1">
              {(summary.passed / (summary.passed + summary.failed + summary.skipped) * 100).toFixed(1)}
              %
            </p>
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow col-span-1">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">
          Test Status Distribution
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={0} // Remove padding between segments
            dataKey="value" labelLine={false} label={renderCustomizedLabel} animationBegin={0} animationDuration={1000} minAngle={2} // Ensure small segments are visible
            >
                {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} className="transition-all duration-200 hover:opacity-80" />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="bottom" height={36} formatter={(value, entry) => <span className="inline-flex items-center px-2 py-1 rounded-md" style={{
              color: entry.color,
              fontWeight: 500
            }}>
                    {value}
                  </span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>;
};