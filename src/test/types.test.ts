import { describe, it, expect } from 'vitest';
import { 
  TestSummary, 
  TestCase, 
  TestSuite, 
  TestData, 
  ReportConfig 
} from '../types';

describe('Types', () => {
  describe('TestSummary', () => {
    it('should correctly type TestSummary object', () => {
      const testSummary: TestSummary = {
        total: 10,
        passed: 8,
        failed: 1,
        skipped: 1,
        time: 120.5
      };

      expect(testSummary.total).toBe(10);
      expect(testSummary.passed).toBe(8);
      expect(testSummary.failed).toBe(1);
      expect(testSummary.skipped).toBe(1);
      expect(testSummary.time).toBe(120.5);
    });

    it('should allow all numeric properties for TestSummary', () => {
      const testSummary: TestSummary = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        time: 0
      };

      expect(typeof testSummary.total).toBe('number');
      expect(typeof testSummary.passed).toBe('number');
      expect(typeof testSummary.failed).toBe('number');
      expect(typeof testSummary.skipped).toBe('number');
      expect(typeof testSummary.time).toBe('number');
    });
  });

  describe('TestCase', () => {
    it('should correctly type TestCase with required properties', () => {
      const testCase: TestCase = {
        name: 'Sample Test',
        status: 'passed',
        time: 5.2
      };

      expect(testCase.name).toBe('Sample Test');
      expect(testCase.status).toBe('passed');
      expect(testCase.time).toBe(5.2);
    });

    it('should support all status types', () => {
      const passedTest: TestCase = {
        name: 'Passed Test',
        status: 'passed',
        time: 1.0
      };

      const failedTest: TestCase = {
        name: 'Failed Test',
        status: 'failed',
        time: 2.0
      };

      const skippedTest: TestCase = {
        name: 'Skipped Test',
        status: 'skipped',
        time: 0.0
      };

      expect(passedTest.status).toBe('passed');
      expect(failedTest.status).toBe('failed');
      expect(skippedTest.status).toBe('skipped');
    });

    it('should support optional properties', () => {
      const testCase: TestCase = {
        name: 'Test with all properties',
        status: 'failed',
        suite: 'Test Suite',
        classname: 'com.example.TestClass',
        time: 3.5,
        errorMessage: 'Test failed due to assertion error',
        failureDetails: {
          message: 'Expected true but was false',
          type: 'AssertionError',
          stackTrace: 'at line 42 in TestClass.java'
        }
      };

      expect(testCase.suite).toBe('Test Suite');
      expect(testCase.classname).toBe('com.example.TestClass');
      expect(testCase.errorMessage).toBe('Test failed due to assertion error');
      expect(testCase.failureDetails?.message).toBe('Expected true but was false');
      expect(testCase.failureDetails?.type).toBe('AssertionError');
      expect(testCase.failureDetails?.stackTrace).toBe('at line 42 in TestClass.java');
    });

    it('should allow null values for optional properties', () => {
      const testCase: TestCase = {
        name: 'Test with null optionals',
        status: 'failed',
        time: 1.0,
        errorMessage: null,
        failureDetails: null
      };

      expect(testCase.errorMessage).toBeNull();
      expect(testCase.failureDetails).toBeNull();
    });
  });

  describe('TestSuite', () => {
    it('should correctly type TestSuite object', () => {
      const testSuite: TestSuite = {
        name: 'Sample Test Suite',
        tests: 5,
        failures: 1,
        errors: 0,
        skipped: 1,
        time: 25.7,
        timestamp: '2024-01-01T12:00:00Z',
        testcases: [
          {
            name: 'Test 1',
            status: 'passed',
            time: 2.0
          },
          {
            name: 'Test 2',
            status: 'failed',
            time: 3.0
          }
        ]
      };

      expect(testSuite.name).toBe('Sample Test Suite');
      expect(testSuite.tests).toBe(5);
      expect(testSuite.failures).toBe(1);
      expect(testSuite.errors).toBe(0);
      expect(testSuite.skipped).toBe(1);
      expect(testSuite.time).toBe(25.7);
      expect(testSuite.timestamp).toBe('2024-01-01T12:00:00Z');
      expect(testSuite.testcases).toHaveLength(2);
      expect(testSuite.testcases[0].name).toBe('Test 1');
      expect(testSuite.testcases[1].status).toBe('failed');
    });

    it('should support empty testcases array', () => {
      const testSuite: TestSuite = {
        name: 'Empty Suite',
        tests: 0,
        failures: 0,
        errors: 0,
        skipped: 0,
        time: 0,
        timestamp: '2024-01-01T12:00:00Z',
        testcases: []
      };

      expect(testSuite.testcases).toHaveLength(0);
      expect(Array.isArray(testSuite.testcases)).toBe(true);
    });
  });

  describe('TestData', () => {
    it('should correctly type TestData object', () => {
      const testData: TestData = {
        summary: {
          total: 3,
          passed: 2,
          failed: 1,
          skipped: 0,
          time: 15.5
        },
        suites: [
          {
            name: 'Test Suite 1',
            tests: 3,
            failures: 1,
            errors: 0,
            skipped: 0,
            time: 15.5,
            timestamp: '2024-01-01T12:00:00Z',
            testcases: [
              {
                name: 'Test A',
                status: 'passed',
                time: 5.0
              },
              {
                name: 'Test B',
                status: 'passed',
                time: 4.5
              },
              {
                name: 'Test C',
                status: 'failed',
                time: 6.0
              }
            ]
          }
        ]
      };

      expect(testData.summary.total).toBe(3);
      expect(testData.suites).toHaveLength(1);
      expect(testData.suites[0].testcases).toHaveLength(3);
    });

    it('should support multiple test suites', () => {
      const testData: TestData = {
        summary: {
          total: 4,
          passed: 3,
          failed: 1,
          skipped: 0,
          time: 20.0
        },
        suites: [
          {
            name: 'Suite 1',
            tests: 2,
            failures: 0,
            errors: 0,
            skipped: 0,
            time: 10.0,
            timestamp: '2024-01-01T12:00:00Z',
            testcases: [
              { name: 'Test 1', status: 'passed', time: 5.0 },
              { name: 'Test 2', status: 'passed', time: 5.0 }
            ]
          },
          {
            name: 'Suite 2',
            tests: 2,
            failures: 1,
            errors: 0,
            skipped: 0,
            time: 10.0,
            timestamp: '2024-01-01T12:00:00Z',
            testcases: [
              { name: 'Test 3', status: 'passed', time: 4.0 },
              { name: 'Test 4', status: 'failed', time: 6.0 }
            ]
          }
        ]
      };

      expect(testData.suites).toHaveLength(2);
      expect(testData.suites[0].name).toBe('Suite 1');
      expect(testData.suites[1].name).toBe('Suite 2');
    });
  });

  describe('ReportConfig', () => {
    it('should correctly type ReportConfig object with all properties', () => {
      const reportConfig: ReportConfig = {
        title: 'Test Report',
        author: 'John Doe',
        projectName: 'Sample Project',
        includeExecutiveSummary: true,
        includeTestMetrics: true,
        includeFailedTests: true,
        includeAllTests: false,
        includeResolutionProgress: false
      };

      expect(reportConfig.title).toBe('Test Report');
      expect(reportConfig.author).toBe('John Doe');
      expect(reportConfig.projectName).toBe('Sample Project');
      expect(reportConfig.includeExecutiveSummary).toBe(true);
      expect(reportConfig.includeTestMetrics).toBe(true);
      expect(reportConfig.includeFailedTests).toBe(true);
      expect(reportConfig.includeAllTests).toBe(false);
      expect(reportConfig.includeResolutionProgress).toBe(false);
    });

    it('should support boolean toggles', () => {
      const configAllEnabled: ReportConfig = {
        title: 'Full Report',
        author: 'Test Author',
        projectName: 'Test Project',
        includeExecutiveSummary: true,
        includeTestMetrics: true,
        includeFailedTests: true,
        includeAllTests: true,
        includeResolutionProgress: true
      };

      const configAllDisabled: ReportConfig = {
        title: 'Minimal Report',
        author: 'Test Author',
        projectName: 'Test Project',
        includeExecutiveSummary: false,
        includeTestMetrics: false,
        includeFailedTests: false,
        includeAllTests: false,
        includeResolutionProgress: false
      };

      expect(configAllEnabled.includeExecutiveSummary).toBe(true);
      expect(configAllEnabled.includeTestMetrics).toBe(true);
      expect(configAllEnabled.includeFailedTests).toBe(true);
      expect(configAllEnabled.includeAllTests).toBe(true);
      expect(configAllEnabled.includeResolutionProgress).toBe(true);

      expect(configAllDisabled.includeExecutiveSummary).toBe(false);
      expect(configAllDisabled.includeTestMetrics).toBe(false);
      expect(configAllDisabled.includeFailedTests).toBe(false);
      expect(configAllDisabled.includeAllTests).toBe(false);
      expect(configAllDisabled.includeResolutionProgress).toBe(false);
    });

    it('should support empty strings', () => {
      const reportConfig: ReportConfig = {
        title: '',
        author: '',
        projectName: '',
        includeExecutiveSummary: true,
        includeTestMetrics: true,
        includeFailedTests: true,
        includeAllTests: false,
        includeResolutionProgress: false
      };

      expect(reportConfig.title).toBe('');
      expect(reportConfig.author).toBe('');
      expect(reportConfig.projectName).toBe('');
    });
  });

  describe('Type Integration', () => {
    it('should work together in realistic scenario', () => {
      // Create test data that uses all types together
      const summary: TestSummary = {
        total: 100,
        passed: 85,
        failed: 10,
        skipped: 5,
        time: 300.75
      };

      const testCases: TestCase[] = [
        {
          name: 'Login Test',
          status: 'passed',
          suite: 'Authentication Suite',
          classname: 'com.example.auth.LoginTest',
          time: 2.5
        },
        {
          name: 'Registration Test',
          status: 'failed',
          suite: 'Authentication Suite',
          classname: 'com.example.auth.RegistrationTest',
          time: 3.2,
          errorMessage: 'Validation failed',
          failureDetails: {
            message: 'Email format is invalid',
            type: 'ValidationException',
            stackTrace: 'at line 45 in RegistrationTest.java'
          }
        },
        {
          name: 'Password Reset Test',
          status: 'skipped',
          suite: 'Authentication Suite',
          classname: 'com.example.auth.PasswordResetTest',
          time: 0
        }
      ];

      const suite: TestSuite = {
        name: 'Authentication Suite',
        tests: 3,
        failures: 1,
        errors: 0,
        skipped: 1,
        time: 5.7,
        timestamp: '2024-01-15T14:30:00Z',
        testcases: testCases
      };

      const testData: TestData = {
        summary: summary,
        suites: [suite]
      };

      const config: ReportConfig = {
        title: 'Automated Test Results Report',
        author: 'QA Team',
        projectName: 'E-commerce Platform',
        includeExecutiveSummary: true,
        includeTestMetrics: true,
        includeFailedTests: true,
        includeAllTests: false,
        includeResolutionProgress: true
      };

      // Verify all types work together
      expect(testData.summary.total).toBe(100);
      expect(testData.suites[0].testcases).toHaveLength(3);
      expect(testData.suites[0].testcases[1].status).toBe('failed');
      expect(config.title).toBe('Automated Test Results Report');
      expect(config.includeResolutionProgress).toBe(true);
    });
  });
});