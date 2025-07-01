import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FailureAnalysisProgress } from '../components/FailureAnalysis/FailureAnalysisProgress';

// Helper function to create test data with failed tests
function createTestDataWithFailures(numFailedTests: number) {
  const suites = [];
  const testsPerSuite = Math.min(20, Math.max(5, Math.floor(numFailedTests / 5)));
  const numSuites = Math.ceil(numFailedTests / testsPerSuite);
  
  for (let suiteIndex = 0; suiteIndex < numSuites; suiteIndex++) {
    const suite = {
      name: `TestSuite${suiteIndex + 1}`,
      testcases: [] as any[]
    };
    
    const testsInThisSuite = Math.min(testsPerSuite, numFailedTests - (suiteIndex * testsPerSuite));
    
    for (let testIndex = 0; testIndex < testsInThisSuite; testIndex++) {
      suite.testcases.push({
        name: `test${suiteIndex}_${testIndex}`,
        classname: `Class${suiteIndex}_${testIndex}`,
        status: 'failed',
        time: (Math.random() * 5).toFixed(2),
        errorMessage: `Test failure ${suiteIndex}_${testIndex}`,
        failureDetails: {
          message: `Assertion error in test ${suiteIndex}_${testIndex}`,
          type: 'AssertionError',
          stackTrace: `Stack trace for test ${suiteIndex}_${testIndex}\n    at line 1\n    at line 2`
        }
      });
    }
    
    suites.push(suite);
  }
  
  return { suites };
}

// Mock child components
vi.mock('../components/Dashboard/TestDetailsModal', () => ({
  TestDetailsModal: ({ test, onClose }: any) => (
    <div data-testid="test-details-modal">
      <div>Test: {test?.name}</div>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../components/Dashboard/FilterControls', () => ({
  FilterControls: ({ 
    searchTerm, 
    setSearchTerm, 
    statusFilter, 
    setStatusFilter,
    showFilters,
    setShowFilters,
    resetFilters,
    statusOptions 
  }: any) => (
    <div data-testid="filter-controls">
      <input 
        data-testid="search-input" 
        value={searchTerm} 
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search tests..."
      />
      <select 
        data-testid="status-filter" 
        value={statusFilter} 
        onChange={(e) => setStatusFilter(e.target.value)}
      >
        {statusOptions?.map((option: any) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button data-testid="show-filters" onClick={() => setShowFilters(!showFilters)}>
        Filters
      </button>
      <button data-testid="reset-filters" onClick={resetFilters}>
        Reset
      </button>
    </div>
  ),
}));

describe('FailureAnalysisProgress', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('Basic functionality', () => {
    it('should render progress overview for failed tests', () => {
      const testData = createTestDataWithFailures(25);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      expect(screen.getByText('Failure Resolution Progress')).toBeInTheDocument();
      expect(screen.getByText('Total Failed Tests')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument(); // Total count
      expect(screen.getByText('25 tests tracked')).toBeInTheDocument();
    });

    it('should show filter controls', () => {
      const testData = createTestDataWithFailures(10);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      expect(screen.getByTestId('filter-controls')).toBeInTheDocument();
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter')).toBeInTheDocument();
    });

    it('should show custom status options for progress tracking', () => {
      const testData = createTestDataWithFailures(5);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      const statusFilter = screen.getByTestId('status-filter');
      expect(statusFilter).toBeInTheDocument();
      
      // Check that custom status options are available
      expect(screen.getByText('All Statuses')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('should show pagination controls when there are more than 50 tests', () => {
      const testData = createTestDataWithFailures(75);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      expect(screen.getByText('Showing 1 to 50 of 75 results')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('(Showing 1-50 of 75)')).toBeInTheDocument();
    });

    it('should not show pagination controls when there are 50 or fewer tests', () => {
      const testData = createTestDataWithFailures(25);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
      expect(screen.queryByText('Showing 1 to')).not.toBeInTheDocument();
    });

    it('should navigate to next page when Next button is clicked', () => {
      const testData = createTestDataWithFailures(75);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      expect(screen.getByText('Showing 51 to 75 of 75 results')).toBeInTheDocument();
    });

    it('should handle large datasets (1000+ tests)', () => {
      const testData = createTestDataWithFailures(1000);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      expect(screen.getByText('1000 tests tracked')).toBeInTheDocument();
      expect(screen.getByText('Showing 1 to 50 of 1000 results')).toBeInTheDocument();
      expect(screen.getByText('(Showing 1-50 of 1000)')).toBeInTheDocument();
    });
  });

  describe('Search and Filter', () => {
    it('should filter tests by search term', () => {
      const testData = createTestDataWithFailures(10);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'test0_0' } });
      
      // Should show fewer results after search
      expect(screen.getByText('1 test tracked')).toBeInTheDocument();
    });

    it('should reset filters when reset button is clicked', () => {
      const testData = createTestDataWithFailures(10);
      
      render(<FailureAnalysisProgress testData={testData} />);
      
      // Apply a search filter
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'test0_0' } });
      
      expect(screen.getByText('1 test tracked')).toBeInTheDocument();
      
      // Reset filters
      const resetButton = screen.getByTestId('reset-filters');
      fireEvent.click(resetButton);
      
      expect(screen.getByText('10 tests tracked')).toBeInTheDocument();
    });
  });
});