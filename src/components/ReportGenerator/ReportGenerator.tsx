import { useState } from 'react';
import { FileTextIcon, EyeIcon } from 'lucide-react';
import { ReportPreview } from './ReportPreview';
import { TestData } from '../../types';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface ReportGeneratorProps {
  testData: TestData | null;
  setActiveTab?: (tab: string) => void;
}

const CONTENT_OPTIONS = [
  { key: 'includeExecutiveSummary', label: 'Include Executive Summary' },
  { key: 'includeTestMetrics', label: 'Include Test Metrics and Charts' },
  { key: 'includeFailedTests', label: 'Include Failed Tests Details' },
  { key: 'includeFlakyTests', label: 'Include Flaky Tests' },
  { key: 'includeAllTests', label: 'Include All Test Cases' },
  { key: 'includeResolutionProgress', label: 'Include Failure Resolution Progress' },
] as const;

export const ReportGenerator = ({
  testData,
  setActiveTab
}: ReportGeneratorProps) => {
  const [reportConfig, setReportConfig] = useState({
    title: 'Automated Test Results Report',
    author: '',
    projectName: '',
    includeExecutiveSummary: true,
    includeTestMetrics: true,
    includeFailedTests: true,
    includeFlakyTests: false, // Flaky status is internal-use only, so reports leaving the team default to excluding it
    includeAllTests: false,
    includeResolutionProgress: false // Add new config option
  });
  const [showPreview, setShowPreview] = useState(false);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {
      name,
      value
    } = e.target;
    setReportConfig({
      ...reportConfig,
      [name]: value
    });
  };
  const handleCheckboxChange = (key: keyof typeof reportConfig, checked: boolean) => {
    setReportConfig({
      ...reportConfig,
      [key]: checked
    });
  };
  const generateReport = () => {
    setShowPreview(true);
  };
  if (!testData) {
    return (
      <EmptyState
        icon={FileTextIcon}
        title="No Test Data Available"
        description="Please upload a JUnit XML file from the Dashboard to generate a report."
        action={
          <Button onClick={() => setActiveTab?.('dashboard')}>
            Go to Dashboard
          </Button>
        }
      />
    );
  }
  if (showPreview) {
    return <ReportPreview testData={testData} config={reportConfig} onBack={() => setShowPreview(false)} />;
  }
  return <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Report Generator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Report Configuration
              </h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Report Title</Label>
                  <Input type="text" id="title" name="title" value={reportConfig.title} onChange={handleInputChange} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="author">Author</Label>
                  <Input type="text" id="author" name="author" value={reportConfig.author} onChange={handleInputChange} placeholder="Your name or organization" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input type="text" id="projectName" name="projectName" value={reportConfig.projectName} onChange={handleInputChange} placeholder="Name of the tested project" />
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Content Options
              </h3>
              <div className="space-y-3">
                {CONTENT_OPTIONS.map(({ key, label }) => (
                  <Label key={key} htmlFor={key} className="flex items-center gap-2 font-normal">
                    <Checkbox
                      id={key}
                      name={key}
                      checked={reportConfig[key]}
                      onCheckedChange={(checked) => handleCheckboxChange(key, checked === true)}
                    />
                    {label}
                  </Label>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-8">
            <Button onClick={generateReport}>
              <EyeIcon className="size-4" />
              Preview Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>;
};
