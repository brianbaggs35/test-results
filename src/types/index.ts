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

export interface FailureProgressItem {
  id: string;
  name: string;
  suite: string;
  errorMessage?: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
  updatedAt?: string;
  assignee?: string;
}

/**
 * Downloaded from the Progress tab once someone finishes working their half
 * of a split report. Bundles the split's test data together with their
 * progress notes so a teammate's export can be merged back with another's
 * into one combined report (see src/utils/combineResults.ts).
 */
export interface ExportBundle {
  version: 1;
  testData: TestData;
  progress: Record<string, FailureProgressItem>;
}