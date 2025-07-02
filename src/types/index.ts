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
  suite?: string;
  classname?: string;
  time: number;
  errorMessage?: string | null;
  failureDetails?: {
    message: string;
    type: string;
    stackTrace: string;
  } | null;
}

export interface TestSuite {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: number;
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