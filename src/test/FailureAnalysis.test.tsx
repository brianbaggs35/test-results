import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FailureAnalysis } from '../components/Dashboard/FailureAnalysis';
import { TestData } from '../types';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  AlertTriangleIcon: () => <div data-testid="alert-triangle-icon" />,
  ClockIcon: () => <div data-testid="clock-icon" />,
  CheckIcon: () => <div data-testid="check-icon" />
}));

describe('FailureAnalysis', () => {
  it('should render "All Tests Passed" when there are no failed tests', () => {
    const testData: TestData = {
      summary: {
        total: 5,
        passed: 5,
        failed: 0,
        skipped: 0,
        time: 50.0
      },
      suites: [
        {
          name: 'Suite 1',
          tests: 5,
          failures: 0,
          errors: 0,
          skipped: 0,
          time: 50.0,
          timestamp: '2024-01-01T12:00:00Z',
          testcases: [
            {
              name: 'Test 1',
              status: 'passed',
              suite: 'Suite 1',
              time: 10.0
            },
            {
              name: 'Test 2',
              status: 'passed',
              suite: 'Suite 1',
              time: 15.0
            }
          ]
        }
      ]
    };

    render(<FailureAnalysis testData={testData} />);

    expect(screen.getByText('All Tests Passed')).toBeInTheDocument();
    expect(screen.getByText('No failures were detected in this test run.')).toBeInTheDocument();
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  it('should render failure analysis when there are failed tests', () => {
    const testData: TestData = {
      summary: {
        total: 5,
        passed: 3,
        failed: 2,
        skipped: 0,
        time: 50.0
      },
      suites: [
        {
          name: 'Suite 1',
          tests: 3,
          failures: 1,
          errors: 0,
          skipped: 0,
          time: 30.0,
          timestamp: '2024-01-01T12:00:00Z',
          testcases: [
            {
              name: 'Test 1',
              status: 'passed',
              suite: 'Suite 1',
              time: 10.0
            },
            {
              name: 'Failed Test 1',
              status: 'failed',
              suite: 'Suite 1',
              time: 15.0,
              errorMessage: 'Assertion failed'
            }
          ]
        },
        {
          name: 'Suite 2',
          tests: 2,
          failures: 1,
          errors: 0,
          skipped: 0,
          time: 20.0,
          timestamp: '2024-01-01T12:00:00Z',
          testcases: [
            {
              name: 'Failed Test 2',
              status: 'failed',
              suite: 'Suite 2',
              time: 20.0,
              errorMessage: 'Another failure'
            }
          ]
        }
      ]
    };

    render(<FailureAnalysis testData={testData} />);

    expect(screen.getByText('Failure Analysis')).toBeInTheDocument();
    expect(screen.getByText('2 failed tests detected')).toBeInTheDocument();
    expect(screen.getByText('Failed Test 1')).toBeInTheDocument();
    expect(screen.getByText('Failed Test 2')).toBeInTheDocument();
  });

  it('should handle single failed test correctly', () => {
    const testData: TestData = {
      summary: {
        total: 2,
        passed: 1,
        failed: 1,
        skipped: 0,
        time: 25.0
      },
      suites: [
        {
          name: 'Suite 1',
          tests: 2,
          failures: 1,
          errors: 0,
          skipped: 0,
          time: 25.0,
          timestamp: '2024-01-01T12:00:00Z',
          testcases: [
            {
              name: 'Test 1',
              status: 'passed',
              suite: 'Suite 1',
              time: 10.0
            },
            {
              name: 'Failed Test',
              status: 'failed',
              suite: 'Suite 1',
              time: 15.0,
              errorMessage: 'Test failed'
            }
          ]
        }
      ]
    };

    render(<FailureAnalysis testData={testData} />);

    expect(screen.getByText('Failure Analysis')).toBeInTheDocument();
    expect(screen.getByText('1 failed test detected')).toBeInTheDocument();
    expect(screen.getByText('Failed Test')).toBeInTheDocument();
  });

  it('should display error messages for failed tests', () => {
    const testData: TestData = {
      summary: {
        total: 1,
        passed: 0,
        failed: 1,
        skipped: 0,
        time: 15.0
      },
      suites: [
        {
          name: 'Suite 1',
          tests: 1,
          failures: 1,
          errors: 0,
          skipped: 0,
          time: 15.0,
          timestamp: '2024-01-01T12:00:00Z',
          testcases: [
            {
              name: 'Failed Test',
              status: 'failed',
              suite: 'Suite 1',
              time: 15.0,
              errorMessage: 'Expected 5 but got 3'
            }
          ]
        }
      ]
    };

    render(<FailureAnalysis testData={testData} />);

    expect(screen.getByText('Failed Test')).toBeInTheDocument();
    expect(screen.getByText('Expected 5 but got 3')).toBeInTheDocument();
  });

  it('should handle tests from multiple suites', () => {
    const testData: TestData = {
      summary: {
        total: 4,
        passed: 2,
        failed: 2,
        skipped: 0,
        time: 40.0
      },
      suites: [
        {
          name: 'Auth Suite',
          tests: 2,
          failures: 1,
          errors: 0,
          skipped: 0,
          time: 20.0,
          timestamp: '2024-01-01T12:00:00Z',
          testcases: [
            {
              name: 'Login Test',
              status: 'failed',
              suite: 'Auth Suite',
              time: 10.0,
              errorMessage: 'Login failed'
            },
            {
              name: 'Logout Test',
              status: 'passed',
              suite: 'Auth Suite',
              time: 10.0
            }
          ]
        },
        {
          name: 'API Suite',
          tests: 2,
          failures: 1,
          errors: 0,
          skipped: 0,
          time: 20.0,
          timestamp: '2024-01-01T12:00:00Z',
          testcases: [
            {
              name: 'GET Test',
              status: 'failed',
              suite: 'API Suite',
              time: 10.0,
              errorMessage: 'API returned 500'
            },
            {
              name: 'POST Test',
              status: 'passed',
              suite: 'API Suite',
              time: 10.0
            }
          ]
        }
      ]
    };

    render(<FailureAnalysis testData={testData} />);

    expect(screen.getByText('2 failed tests detected')).toBeInTheDocument();
    expect(screen.getByText('Login Test')).toBeInTheDocument();
    expect(screen.getByText('GET Test')).toBeInTheDocument();
    expect(screen.getByText('Auth Suite')).toBeInTheDocument();
    expect(screen.getByText('API Suite')).toBeInTheDocument();
  });
});