import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestResultsList } from '../components/Dashboard/TestResultsList';
import { TestData } from '../types';

// Mock child components
vi.mock('../components/Dashboard/TestDetailsModal', () => ({
  TestDetailsModal: ({ test, onClose }: { test: any; onClose: () => void }) => (
    <div data-testid="test-details-modal">
      <span>Test: {test.name}</span>
      <button onClick={onClose} data-testid="modal-close">Close</button>
    </div>
  )
}));

vi.mock('../components/Dashboard/FilterControls', () => ({
  FilterControls: ({ 
    searchTerm, 
    setSearchTerm, 
    statusFilter, 
    setStatusFilter,
    showFilters,
    setShowFilters,
    resetFilters
  }: any) => (
    <div data-testid="filter-controls">
      <input 
        value={searchTerm} 
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search tests..."
        data-testid="search-input"
      />
      <select 
        value={statusFilter} 
        onChange={(e) => setStatusFilter(e.target.value)}
        data-testid="status-filter"
      >
        <option value="all">All</option>
        <option value="passed">Passed</option>
        <option value="failed">Failed</option>
        <option value="skipped">Skipped</option>
      </select>
      <button onClick={() => setShowFilters(!showFilters)} data-testid="toggle-filters">
        Toggle Filters
      </button>
      <button onClick={resetFilters} data-testid="reset-filters">
        Reset Filters
      </button>
    </div>
  )
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ChevronDownIcon: () => <div data-testid="chevron-down-icon" />,
  ChevronUpIcon: () => <div data-testid="chevron-up-icon" />,
  CheckIcon: () => <div data-testid="check-icon" />,
  XIcon: () => <div data-testid="x-icon" />,
  AlertCircleIcon: () => <div data-testid="alert-circle-icon" />
}));

describe('TestResultsList', () => {
  let mockTestData: TestData;

  beforeEach(() => {
    mockTestData = {
      summary: {
        total: 6,
        passed: 3,
        failed: 2,
        skipped: 1,
        time: 120.0
      },
      suites: [
        {
          name: 'Auth Suite',
          tests: 3,
          failures: 1,
          errors: 0,
          skipped: 1,
          time: 60.0,
          timestamp: '2024-01-01T12:00:00Z',
          testcases: [
            {
              name: 'Login Test',
              status: 'passed',
              suite: 'Auth Suite',
              time: 15.0,
              classname: 'AuthTests'
            },
            {
              name: 'Logout Test',
              status: 'failed',
              suite: 'Auth Suite',
              time: 25.0,
              errorMessage: 'Logout failed',
              classname: 'AuthTests'
            },
            {
              name: 'Password Reset Test',
              status: 'skipped',
              suite: 'Auth Suite',
              time: 0.0,
              classname: 'AuthTests'
            }
          ]
        },
        {
          name: 'API Suite',
          tests: 3,
          failures: 1,
          errors: 0,
          skipped: 0,
          time: 60.0,
          timestamp: '2024-01-01T12:00:00Z',
          testcases: [
            {
              name: 'GET Test',
              status: 'passed',
              suite: 'API Suite',
              time: 20.0,
              classname: 'APITests'
            },
            {
              name: 'POST Test',
              status: 'passed',
              suite: 'API Suite',
              time: 30.0,
              classname: 'APITests'
            },
            {
              name: 'DELETE Test',
              status: 'failed',
              suite: 'API Suite',
              time: 10.0,
              errorMessage: 'Delete failed',
              classname: 'APITests'
            }
          ]
        }
      ]
    };
  });

  it('should render test results list with filter controls', () => {
    render(<TestResultsList testData={mockTestData} />);

    expect(screen.getByTestId('filter-controls')).toBeInTheDocument();
    expect(screen.getByText('Showing 6 of 6 tests')).toBeInTheDocument();
  });

  it('should display all test results by default', () => {
    render(<TestResultsList testData={mockTestData} />);

    expect(screen.getByText('Login Test')).toBeInTheDocument();
    expect(screen.getByText('Logout Test')).toBeInTheDocument();
    expect(screen.getByText('Password Reset Test')).toBeInTheDocument();
    expect(screen.getByText('GET Test')).toBeInTheDocument();
    expect(screen.getByText('POST Test')).toBeInTheDocument();
    expect(screen.getByText('DELETE Test')).toBeInTheDocument();
  });

  it('should filter tests by search term', async () => {
    const user = userEvent.setup();
    render(<TestResultsList testData={mockTestData} />);

    const searchInput = screen.getByTestId('search-input');
    await user.type(searchInput, 'Login');

    // Only Login Test should be visible
    expect(screen.getByText('Login Test')).toBeInTheDocument();
    expect(screen.queryByText('Logout Test')).not.toBeInTheDocument();
  });

  it('should filter tests by status', async () => {
    const user = userEvent.setup();
    render(<TestResultsList testData={mockTestData} />);

    const statusFilter = screen.getByTestId('status-filter');
    await user.selectOptions(statusFilter, 'failed');

    // Only failed tests should be visible
    expect(screen.getByText('Logout Test')).toBeInTheDocument();
    expect(screen.getByText('DELETE Test')).toBeInTheDocument();
    expect(screen.queryByText('Login Test')).not.toBeInTheDocument();
  });

  it('should show correct status icons for different test statuses', () => {
    render(<TestResultsList testData={mockTestData} />);

    // Check for status icons (assuming they're rendered in the table)
    expect(screen.getAllByTestId('check-icon')).toHaveLength(3); // 3 passed tests
    expect(screen.getAllByTestId('x-icon')).toHaveLength(2); // 2 failed tests
    expect(screen.getAllByTestId('alert-circle-icon')).toHaveLength(1); // 1 skipped test
  });

  it('should open test details modal when test is clicked', async () => {
    const user = userEvent.setup();
    render(<TestResultsList testData={mockTestData} />);

    const loginTest = screen.getByText('Login Test');
    await user.click(loginTest);

    expect(screen.getByTestId('test-details-modal')).toBeInTheDocument();
    expect(screen.getByText('Test: Login Test')).toBeInTheDocument();
  });

  it('should close test details modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<TestResultsList testData={mockTestData} />);

    // Open modal
    const loginTest = screen.getByText('Login Test');
    await user.click(loginTest);

    expect(screen.getByTestId('test-details-modal')).toBeInTheDocument();

    // Close modal
    const closeButton = screen.getByTestId('modal-close');
    await user.click(closeButton);

    expect(screen.queryByTestId('test-details-modal')).not.toBeInTheDocument();
  });

  it('should sort tests by name ascending by default', () => {
    render(<TestResultsList testData={mockTestData} />);

    const testNames = screen.getAllByText(/Test$/).map(el => el.textContent);
    expect(testNames[0]).toBe('DELETE Test');
    expect(testNames[1]).toBe('GET Test');
    expect(testNames[2]).toBe('Login Test');
  });

  it('should sort tests when column header is clicked', async () => {
    const user = userEvent.setup();
    render(<TestResultsList testData={mockTestData} />);

    // Click on name column header to change sort direction
    const nameHeader = screen.getByText('Test Name');
    await user.click(nameHeader);

    // Should now be sorted descending
    const testNames = screen.getAllByText(/Test$/).map(el => el.textContent);
    expect(testNames[0]).toBe('POST Test');
    expect(testNames[1]).toBe('Password Reset Test');
  });

  it('should display suite information for each test', () => {
    render(<TestResultsList testData={mockTestData} />);

    expect(screen.getAllByText('Auth Suite')).toHaveLength(3);
    expect(screen.getAllByText('API Suite')).toHaveLength(3);
  });

  it('should display test duration', () => {
    render(<TestResultsList testData={mockTestData} />);

    expect(screen.getByText('15.00s')).toBeInTheDocument(); // Login Test
    expect(screen.getByText('25.00s')).toBeInTheDocument(); // Logout Test
    expect(screen.getByText('30.00s')).toBeInTheDocument(); // POST Test
  });

  it('should reset filters when reset button is clicked', async () => {
    const user = userEvent.setup();
    render(<TestResultsList testData={mockTestData} />);

    // Apply a filter
    const statusFilter = screen.getByTestId('status-filter');
    await user.selectOptions(statusFilter, 'failed');

    // Verify filter is applied
    expect(screen.queryByText('Login Test')).not.toBeInTheDocument();

    // Reset filters
    const resetButton = screen.getByTestId('reset-filters');
    await user.click(resetButton);

    // All tests should be visible again
    expect(screen.getByText('Login Test')).toBeInTheDocument();
  });

  it('should show correct count of filtered results', async () => {
    const user = userEvent.setup();
    render(<TestResultsList testData={mockTestData} />);

    // Filter by failed status
    const statusFilter = screen.getByTestId('status-filter');
    await user.selectOptions(statusFilter, 'failed');

    expect(screen.getByText('Showing 2 of 6 tests')).toBeInTheDocument();
  });

  it('should handle empty test data', () => {
    const emptyTestData: TestData = {
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        time: 0
      },
      suites: []
    };

    render(<TestResultsList testData={emptyTestData} />);

    expect(screen.getByText('Showing 0 of 0 tests')).toBeInTheDocument();
  });

  it('should toggle filters visibility', async () => {
    const user = userEvent.setup();
    render(<TestResultsList testData={mockTestData} />);

    const toggleButton = screen.getByTestId('toggle-filters');
    await user.click(toggleButton);

    // Filter controls should handle the toggle state
    expect(screen.getByTestId('filter-controls')).toBeInTheDocument();
  });

  it('should display class names when available', () => {
    render(<TestResultsList testData={mockTestData} />);

    expect(screen.getAllByText('AuthTests')).toHaveLength(3);
    expect(screen.getAllByText('APITests')).toHaveLength(3);
  });
});