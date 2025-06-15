export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  time: number;
}

export interface TestCase {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  suite: string;
  classname?: string;
  time: string;
  errorMessage?: string;
  failureDetails?: {
    message?: string;
    type?: string;
    stackTrace?: string;
  };
}

export interface TestSuite {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: string;
  timestamp: string;
  testcases: TestCase[];
}

export interface TestData {
  summary: TestSummary;
  suites: TestSuite[];
}

export interface ReportConfig {
  title: string;
  author: string;
  projectName: string;
  includeExecutiveSummary: boolean;
  includeTestMetrics: boolean;
  includeFailedTests: boolean;
  includeAllTests: boolean;
  includeResolutionProgress: boolean;
}