import { PieChart, Pie, Tooltip, Cell, ResponsiveContainer, type PieLabelRenderProps } from 'recharts';
import { CheckCircleIcon, XCircleIcon, ClockIcon, AlertTriangleIcon, TrendingUpIcon } from 'lucide-react';
import { formatDuration } from '../../utils/formatting';
import type { TestData } from '../../types';
import { useChartRenderComplete } from '../../hooks/useChartRenderComplete';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TestMetricsProps {
  testData: TestData;
}

export const TestMetrics: React.FC<TestMetricsProps> = ({
  testData
}) => {
  const { summary } = testData;

  // Use custom hook to add chart-render-complete class for PDF generation
  useChartRenderComplete([testData]);

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
      return <div className="rounded-lg border bg-popover p-4 text-popover-foreground shadow-md">
          <p className="font-medium">{data.name}</p>
          <p className="text-muted-foreground">{data.description}</p>
          <p className="mt-1 text-sm text-muted-foreground">
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
    midAngle = 0,
    innerRadius,
    outerRadius,
    percent = 0,
    value
  }: PieLabelRenderProps) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.7;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    // Don't show labels for very small segments
    if (percent < 0.02) {
      return null;
    }
    return <text x={x} y={y} fill="currentColor" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-medium text-foreground">
        {value} ({(percent * 100).toFixed(1)}%)
      </text>;
  };

  const successRate = (summary.passed / (summary.passed + summary.failed + summary.skipped) * 100).toFixed(1);

  const stats = [
    { key: 'passed', label: 'Passed', value: summary.passed, icon: CheckCircleIcon, ring: 'ring-success/20', chip: 'bg-success/15 text-success', bar: 'bg-success' },
    { key: 'failed', label: 'Failed', value: summary.failed, icon: XCircleIcon, ring: 'ring-destructive/20', chip: 'bg-destructive/15 text-destructive', bar: 'bg-destructive' },
    { key: 'skipped', label: 'Skipped', value: summary.skipped, icon: AlertTriangleIcon, ring: 'ring-warning/20', chip: 'bg-warning/15 text-warning', bar: 'bg-warning' },
  ] as const;

  return <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Test Execution Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {stats.map(({ key, label, value, icon: Icon, ring, chip, bar }) => {
              const pct = summary.total > 0 ? (value / summary.total * 100) : 0;
              return (
                <div key={key} data-testid={`stat-${key}`} className={cn('rounded-xl border bg-card p-4 ring-1', ring)}>
                  <div className={cn('flex size-9 items-center justify-center rounded-full', chip)}>
                    <Icon className="size-5" />
                  </div>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ClockIcon className="size-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Duration:</p>
                <p className="text-lg font-bold text-foreground">
                  {formatDuration(summary.time)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <TrendingUpIcon className="size-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Success Rate:</p>
                <p className="text-lg font-bold text-foreground">
                  {successRate}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Test Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={0} // Remove padding between segments
              dataKey="value" labelLine={false} label={renderCustomizedLabel} animationBegin={0} animationDuration={1000} minAngle={2} // Ensure small segments are visible
              >
                  {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{summary.total}</span>
              <span className="text-xs text-muted-foreground">tests</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>;
};
