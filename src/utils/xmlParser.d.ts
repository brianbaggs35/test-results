export interface TestCase {
  name: string;
  classname: string;
  time: number;
  status: 'passed' | 'failed' | 'skipped';
  errorMessage: string | null;
  failureDetails: {
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

export interface ParsedTestData {
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    time: number;
  };
  suites: TestSuite[];
}

export declare function parseJUnitXML(xmlContent: string): ParsedTestData;