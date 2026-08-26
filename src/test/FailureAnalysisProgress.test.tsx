import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FailureAnalysisProgress } from '../components/FailureAnalysis/FailureAnalysisProgress';
import * as exportBundleUtil from '../utils/exportBundle';
import { testIdentityKey } from '../utils/testIdentity';

// Helper function to create test data with failed tests
function createTestDataWithFailures(numFailedTests: number) {
  const suites = [];
  const testsPerSuite = Math.min(20, Math.max(5, Math.floor(numFailedTests / 5)));
  const numSuites = Math.ceil(numFailedTests / testsPerSuite);

  for (let suiteIndex = 0; suiteIndex < numSuites; suiteIndex++) {
    const suite = {
      name: `TestSuite${suiteIndex + 1}`,
      tests: 0,
      failures: 0,
      errors: 0,
      skipped: 0,
      time: 0,
      timestamp: `2024-01-01T12:0${suiteIndex}:00Z`,
      testcases: [] as Array<{
        name: string;
        status: 'passed' | 'failed' | 'skipped';
        suite: string;
        classname?: string;
        time: number;
        failureDetails?: { message: string; type: string; stackTrace: string };
      }>
    };

    const testsInThisSuite = Math.min(testsPerSuite, numFailedTests - (suiteIndex * testsPerSuite));

    for (let testIndex = 0; testIndex < testsInThisSuite; testIndex++) {
      const testTime = Math.random() * 5;
      suite.testcases.push({
        name: `test${suiteIndex}_${testIndex}`,
        classname: `Class${suiteIndex}_${testIndex}`,
        suite: suite.name,
        status: 'failed' as const,
        time: testTime,
        failureDetails: {
          message: `Assertion error in test ${suiteIndex}_${testIndex}`,
          type: 'AssertionError',
          stackTrace: `Stack trace for test ${suiteIndex}_${testIndex}\n    at line 1\n    at line 2`
        }
      });
      suite.time += testTime;
      suite.failures++;
    }

    suite.tests = testsInThisSuite;
    suites.push(suite);
  }

  return {
    summary: {
      total: numFailedTests,
      passed: 0,
      failed: numFailedTests,
      skipped: 0,
      time: suites.reduce((total, suite) => total + suite.time, 0)
    },
    suites
  };
}

// Mock child components
vi.mock('../components/Dashboard/TestDetailsModal', () => ({
  TestDetailsModal: ({ test, onClose }: {
    test: { name: string } | null;
    onClose: () => void;
  }) => (
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
  }: {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    statusFilter: string;
    setStatusFilter: (filter: string) => void;
    showFilters: boolean;
    setShowFilters: (show: boolean) => void;
    resetFilters: () => void;
    statusOptions: Array<{ value: string; label: string }>;
  }) => (
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
        {statusOptions?.map((option: { value: string; label: string }) => (
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
      expect(screen.getAllByText('In Progress')).toHaveLength(2); // One in overview, one in filter
      expect(screen.getAllByText('Completed')).toHaveLength(2); // One in overview, one in filter
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

    it('should keep tests that match a non-"all" status filter', () => {
      const testData = createTestDataWithFailures(10);

      render(<FailureAnalysisProgress testData={testData} />);

      // Every test starts out 'pending', so filtering to 'pending' should keep them all.
      fireEvent.change(screen.getByTestId('status-filter'), { target: { value: 'pending' } });

      expect(screen.getByText('10 tests tracked')).toBeInTheDocument();
    });
  });

  describe('Bulk Actions', () => {
    it('should show bulk action controls', () => {
      const testData = createTestDataWithFailures(5);

      render(<FailureAnalysisProgress testData={testData} />);

      // Should show Select All checkbox
      expect(screen.getByText('Select All (0 selected)')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /select all/i })).toBeInTheDocument();
    });

    it('should select and deselect individual tests', () => {
      const testData = createTestDataWithFailures(3);

      render(<FailureAnalysisProgress testData={testData} />);

      // Get all individual checkboxes (excluding the "Select All" checkbox)
      const checkboxes = screen.getAllByRole('checkbox');
      const testCheckboxes = checkboxes.slice(1); // Skip the "Select All" checkbox

      expect(testCheckboxes).toHaveLength(3);

      // Select first test
      fireEvent.click(testCheckboxes[0]);
      expect(screen.getByText('Select All (1 selected)')).toBeInTheDocument();

      // Select second test
      fireEvent.click(testCheckboxes[1]);
      expect(screen.getByText('Select All (2 selected)')).toBeInTheDocument();

      // Deselect first test
      fireEvent.click(testCheckboxes[0]);
      expect(screen.getByText('Select All (1 selected)')).toBeInTheDocument();
    });

    it('should select and deselect all tests', () => {
      const testData = createTestDataWithFailures(3);

      render(<FailureAnalysisProgress testData={testData} />);

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });

      // Select all tests
      fireEvent.click(selectAllCheckbox);
      expect(screen.getByText('Select All (3 selected)')).toBeInTheDocument();
      expect(selectAllCheckbox).toBeChecked();

      // Deselect all tests
      fireEvent.click(selectAllCheckbox);
      expect(screen.getByText('Select All (0 selected)')).toBeInTheDocument();
      expect(selectAllCheckbox).not.toBeChecked();
    });

    it('should show bulk action buttons when tests are selected', () => {
      const testData = createTestDataWithFailures(3);

      render(<FailureAnalysisProgress testData={testData} />);

      // Initially should not show bulk action buttons
      expect(screen.queryByText('Bulk Actions:')).not.toBeInTheDocument();

      // Select a test
      const checkboxes = screen.getAllByRole('checkbox');
      const testCheckbox = checkboxes[1]; // First test checkbox (skip Select All)
      fireEvent.click(testCheckbox);

      // Should now show bulk action buttons
      expect(screen.getByText('Bulk Actions:')).toBeInTheDocument();
      expect(screen.getByText('Mark as Pending')).toBeInTheDocument();
      expect(screen.getByText('Mark as In Progress')).toBeInTheDocument();
      expect(screen.getByText('Mark as Complete')).toBeInTheDocument();
    });

    it('should perform bulk status updates', () => {
      const testData = createTestDataWithFailures(3);

      render(<FailureAnalysisProgress testData={testData} />);

      // Select all tests
      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
      fireEvent.click(selectAllCheckbox);

      // Verify tests are selected
      expect(screen.getByText('Select All (3 selected)')).toBeInTheDocument();

      // Click "Mark as In Progress"
      const inProgressButton = screen.getByText('Mark as In Progress');
      fireEvent.click(inProgressButton);

      // Should clear selection after bulk update
      expect(screen.getByText('Select All (0 selected)')).toBeInTheDocument();

      // Bulk actions should be hidden since no tests are selected
      expect(screen.queryByText('Bulk Actions:')).not.toBeInTheDocument();
    });

    it('should clear selection after bulk update', () => {
      const testData = createTestDataWithFailures(2);

      render(<FailureAnalysisProgress testData={testData} />);

      // Select all tests
      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
      fireEvent.click(selectAllCheckbox);
      expect(screen.getByText('Select All (2 selected)')).toBeInTheDocument();

      // Perform bulk update
      const completeButton = screen.getByText('Mark as Complete');
      fireEvent.click(completeButton);

      // Selection should be cleared
      expect(screen.getByText('Select All (0 selected)')).toBeInTheDocument();
      expect(screen.queryByText('Bulk Actions:')).not.toBeInTheDocument();
    });
  });

  describe('Export Progress', () => {
    it('should be disabled when there are no failed tests', () => {
      const testData = createTestDataWithFailures(0);
      render(<FailureAnalysisProgress testData={testData} />);

      expect(screen.getByText('Export Progress').closest('button')).toBeDisabled();
    });

    it('should export the current testData and progress when clicked', () => {
      const spy = vi.spyOn(exportBundleUtil, 'exportProgressBundle').mockImplementation(async () => {});
      const testData = createTestDataWithFailures(3);
      render(<FailureAnalysisProgress testData={testData} />);

      fireEvent.click(screen.getByText('Export Progress'));

      expect(spy).toHaveBeenCalledTimes(1);
      const [exportedData, exportedProgress] = spy.mock.calls[0];
      expect(exportedData).toBe(testData);
      expect(Object.keys(exportedProgress)).toHaveLength(3);
      spy.mockRestore();
    });
  });

  describe('Import Progress', () => {
    it('should be disabled when there are no failed tests', () => {
      const testData = createTestDataWithFailures(0);
      render(<FailureAnalysisProgress testData={testData} />);

      expect(screen.getByText('Import Progress').closest('button')).toBeDisabled();
    });

    it('should restore status, notes, and assignee from an imported file for a matching test', async () => {
      const user = userEvent.setup();
      const testData = createTestDataWithFailures(1);
      render(<FailureAnalysisProgress testData={testData} />);

      const testId = testIdentityKey('TestSuite1', 'Class0_0', 'test0_0');
      const bundle = {
        version: 1,
        testData,
        progress: {
          [testId]: {
            id: testId,
            name: 'test0_0',
            suite: 'TestSuite1',
            status: 'completed',
            notes: 'Fixed the flaky assertion',
            assignee: 'Jane Doe',
            updatedAt: '2024-03-01T00:00:00Z',
          },
        },
      };
      const file = new File([JSON.stringify(bundle)], 'export.json', { type: 'application/json' });

      await user.upload(screen.getByLabelText('Upload progress export file'), file);

      expect(await screen.findByText(/Imported progress for 1 test/)).toBeInTheDocument();
      expect(screen.getByText('Fixed the flaky assertion')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    it('should report entries in the file that no longer match a currently loaded test', async () => {
      const user = userEvent.setup();
      const testData = createTestDataWithFailures(1);
      render(<FailureAnalysisProgress testData={testData} />);

      const testId = testIdentityKey('TestSuite1', 'Class0_0', 'test0_0');
      const longGoneId = testIdentityKey('TestSuite1', 'Class0_0', 'longGone');
      const bundle = {
        version: 1,
        testData,
        progress: {
          [testId]: { id: testId, name: 'test0_0', suite: 'TestSuite1', status: 'completed' },
          [longGoneId]: { id: longGoneId, name: 'longGone', suite: 'TestSuite1', status: 'completed' },
        },
      };
      const file = new File([JSON.stringify(bundle)], 'export.json', { type: 'application/json' });

      await user.upload(screen.getByLabelText('Upload progress export file'), file);

      expect(await screen.findByText(/Imported progress for 1 test/)).toBeInTheDocument();
      expect(screen.getByText(/1 entry in the file didn't match a test in the currently loaded results/)).toBeInTheDocument();
    });

    it('should show an error when the imported file is not valid JSON', async () => {
      const user = userEvent.setup();
      const testData = createTestDataWithFailures(1);
      render(<FailureAnalysisProgress testData={testData} />);

      const file = new File(['not json'], 'bad.json', { type: 'application/json' });
      await user.upload(screen.getByLabelText('Upload progress export file'), file);

      expect(await screen.findByText(/not valid JSON/)).toBeInTheDocument();
    });

    it('should reject a file exported from a different XML with no overlapping tests', async () => {
      const user = userEvent.setup();
      const testData = createTestDataWithFailures(1);
      render(<FailureAnalysisProgress testData={testData} />);

      const otherTestData = createTestDataWithFailures(1);
      otherTestData.suites[0].name = 'CompletelyDifferentSuite';
      otherTestData.suites[0].testcases[0].name = 'completelyDifferentTest';
      const otherId = testIdentityKey('CompletelyDifferentSuite', 'Class0_0', 'completelyDifferentTest');
      const bundle = {
        version: 1,
        testData: otherTestData,
        progress: {
          [otherId]: {
            id: otherId,
            name: 'completelyDifferentTest',
            suite: 'CompletelyDifferentSuite',
            status: 'completed',
          },
        },
      };
      const file = new File([JSON.stringify(bundle)], 'export-a.json', { type: 'application/json' });

      await user.upload(screen.getByLabelText('Upload progress export file'), file);

      expect(await screen.findByText(/doesn't match the currently loaded results/)).toBeInTheDocument();
      // Nothing should have been imported - the original pending status is untouched.
      expect(screen.queryByText(/Imported progress for/)).not.toBeInTheDocument();
    });

    it('should persist imported progress to localStorage', async () => {
      const setItemSpy = vi.spyOn(window.localStorage, 'setItem');
      const user = userEvent.setup();
      const testData = createTestDataWithFailures(1);
      render(<FailureAnalysisProgress testData={testData} />);

      const testId = testIdentityKey('TestSuite1', 'Class0_0', 'test0_0');
      const bundle = {
        version: 1,
        testData,
        progress: {
          [testId]: { id: testId, name: 'test0_0', suite: 'TestSuite1', status: 'in_progress', assignee: 'Sam' },
        },
      };
      const file = new File([JSON.stringify(bundle)], 'export.json', { type: 'application/json' });

      await user.upload(screen.getByLabelText('Upload progress export file'), file);
      await screen.findByText(/Imported progress for 1 test/);

      expect(setItemSpy).toHaveBeenCalledWith('testFixProgress', expect.stringContaining('"assignee":"Sam"'));
      setItemSpy.mockRestore();
    });

    it('should do nothing when the file picker is dismissed without selecting a file', async () => {
      const testData = createTestDataWithFailures(1);
      render(<FailureAnalysisProgress testData={testData} />);

      fireEvent.change(screen.getByLabelText('Upload progress export file'), { target: { files: [] } });

      expect(screen.queryByTestId('import-progress-summary')).not.toBeInTheDocument();
      expect(screen.queryByTestId('import-progress-error')).not.toBeInTheDocument();
    });

    it('should pluralize both counts when no entries match and several are skipped', async () => {
      const user = userEvent.setup();
      const testData = createTestDataWithFailures(2);
      render(<FailureAnalysisProgress testData={testData} />);

      // Same testData (so the structure-hash gate passes), but progress ids for tests
      // that don't exist in it, so every entry is skipped rather than matched.
      const bogusId1 = testIdentityKey('TestSuite1', 'Class0_0', 'bogus1');
      const bogusId2 = testIdentityKey('TestSuite1', 'Class0_1', 'bogus2');
      const bundle = {
        version: 1,
        testData,
        progress: {
          [bogusId1]: { id: bogusId1, name: 'bogus1', suite: 'TestSuite1', status: 'completed' },
          [bogusId2]: { id: bogusId2, name: 'bogus2', suite: 'TestSuite1', status: 'completed' },
        },
      };
      const file = new File([JSON.stringify(bundle)], 'export.json', { type: 'application/json' });

      await user.upload(screen.getByLabelText('Upload progress export file'), file);

      expect(await screen.findByText(/Imported progress for 0 tests/)).toBeInTheDocument();
      expect(screen.getByText(/2 entries in the file didn't match a test in the currently loaded results and were skipped/)).toBeInTheDocument();
    });
  });

  describe('Restoring saved progress from localStorage', () => {
    it('should restore a previously saved status and open the stack trace modal for a matching test', async () => {
      const user = userEvent.setup();
      const testData = createTestDataWithFailures(1);
      const matchingId = testIdentityKey('TestSuite1', 'Class0_0', 'test0_0');
      const getItemSpy = vi.spyOn(window.localStorage, 'getItem').mockReturnValue(JSON.stringify({
        [matchingId]: {
          id: matchingId,
          name: 'test0_0',
          suite: 'TestSuite1',
          status: 'completed',
          notes: 'Already fixed',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      }));

      render(<FailureAnalysisProgress testData={testData} />);

      expect(screen.getByText('Already fixed')).toBeInTheDocument();

      await user.click(screen.getByText('View Stack Trace'));

      expect(screen.getByTestId('test-details-modal')).toBeInTheDocument();
      expect(screen.getByText('Test: test0_0')).toBeInTheDocument();
      getItemSpy.mockRestore();
    });

    it('should do nothing when the stack trace is requested for a test no longer in the current results', async () => {
      const user = userEvent.setup();
      const testData = createTestDataWithFailures(1);
      const staleId = testIdentityKey('OldSuite', 'OldClass', 'oldTest');
      const getItemSpy = vi.spyOn(window.localStorage, 'getItem').mockReturnValue(JSON.stringify({
        [staleId]: {
          id: staleId,
          name: 'oldTest',
          suite: 'OldSuite',
          status: 'pending',
          errorMessage: 'boom',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      }));

      render(<FailureAnalysisProgress testData={testData} />);

      await user.click(screen.getByText('View Stack Trace'));

      expect(screen.queryByTestId('test-details-modal')).not.toBeInTheDocument();
      getItemSpy.mockRestore();
    });
  });

  describe('Null testData scenario', () => {
    it('should display message when testData is null', () => {
      render(<FailureAnalysisProgress testData={null} />);

      expect(screen.getByText('No Test Data Available')).toBeInTheDocument();
      expect(screen.getByText('Please upload a JUnit XML file from the Dashboard to view failure resolution progress.')).toBeInTheDocument();
    });
  });

  describe('Status update interactions', () => {
    it('should show status update buttons when edit is clicked', () => {
      const testData = createTestDataWithFailures(2);
      render(<FailureAnalysisProgress testData={testData} />);

      const editButton = screen.getAllByText('Edit')[0];
      fireEvent.click(editButton);

      expect(screen.getByRole('button', { name: 'Pending' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'In Progress' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Complete' })).toBeInTheDocument();
    });

    it('should update test status to pending', () => {
      const testData = createTestDataWithFailures(1);
      render(<FailureAnalysisProgress testData={testData} />);

      const editButton = screen.getByText('Edit');
      fireEvent.click(editButton);

      const pendingButton = screen.getByRole('button', { name: 'Pending' });
      fireEvent.click(pendingButton);

      // Status should be updated
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('should update test status to in_progress', () => {
      const testData = createTestDataWithFailures(1);
      render(<FailureAnalysisProgress testData={testData} />);

      const editButton = screen.getByText('Edit');
      fireEvent.click(editButton);

      const inProgressButton = screen.getByRole('button', { name: 'In Progress' });
      fireEvent.click(inProgressButton);

      // Status should be updated
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('should update test status to completed', () => {
      const testData = createTestDataWithFailures(1);
      render(<FailureAnalysisProgress testData={testData} />);

      const editButton = screen.getByText('Edit');
      fireEvent.click(editButton);

      const completeButton = screen.getByText('Complete');
      fireEvent.click(completeButton);

      // Status should be updated
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('Notes and assignee functionality', () => {
    it('should display assignee and notes inputs when test is selected', () => {
      const testData = createTestDataWithFailures(1);
      render(<FailureAnalysisProgress testData={testData} />);

      const editButton = screen.getByText('Edit');
      fireEvent.click(editButton);

      expect(screen.getByPlaceholderText('Who is working on this?')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Add any notes about the fix...')).toBeInTheDocument();
    });

    it('should handle assignee input changes', () => {
      const testData = createTestDataWithFailures(1);
      render(<FailureAnalysisProgress testData={testData} />);

      const editButton = screen.getByText('Edit');
      fireEvent.click(editButton);

      const assigneeInput = screen.getByPlaceholderText('Who is working on this?');
      fireEvent.change(assigneeInput, { target: { value: 'John Doe' } });

      expect(assigneeInput).toHaveValue('John Doe');
    });

    it('should handle notes input changes', () => {
      const testData = createTestDataWithFailures(1);
      render(<FailureAnalysisProgress testData={testData} />);

      const editButton = screen.getByText('Edit');
      fireEvent.click(editButton);

      const notesInput = screen.getByPlaceholderText('Add any notes about the fix...');
      fireEvent.change(notesInput, { target: { value: 'This is a test note' } });

      expect(notesInput).toHaveValue('This is a test note');
    });

    it('should display existing notes when not editing', async () => {
      const testData = createTestDataWithFailures(1);
      render(<FailureAnalysisProgress testData={testData} />);

      // First, click Edit to enter editing mode
      const editButton = screen.getByText('Edit');
      fireEvent.click(editButton);

      // Add notes and assignee
      const notesInput = screen.getByPlaceholderText('Add any notes about the fix...');
      const assigneeInput = screen.getByPlaceholderText('Who is working on this?');

      fireEvent.change(notesInput, { target: { value: 'Existing note for this test' } });
      fireEvent.change(assigneeInput, { target: { value: 'Jane Doe' } });

      // Set status to in_progress to save the notes
      const inProgressButton = screen.getByRole('button', { name: 'In Progress' });
      fireEvent.click(inProgressButton);

      // Now verify that the notes are displayed
      expect(screen.getByText('Notes:')).toBeInTheDocument();
      expect(screen.getByText('Existing note for this test')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });
  });

  describe('Pagination edge cases', () => {
    it('should handle pagination navigation', () => {
      const testData = createTestDataWithFailures(100);
      render(<FailureAnalysisProgress testData={testData} />);

      // Should have pagination controls
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });

    it('should handle page number clicks', () => {
      const testData = createTestDataWithFailures(100);
      render(<FailureAnalysisProgress testData={testData} />);

      // Click on page 2
      const page2Button = screen.getByText('2');
      fireEvent.click(page2Button);

      // Should navigate to page 2
      expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
    });
  });

  describe('Bulk Comment feature', () => {
    it('should show Bulk Comment button when items are selected', () => {
      const testData = createTestDataWithFailures(5);
      render(<FailureAnalysisProgress testData={testData} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]); // first test checkbox

      expect(screen.getByTestId('floating-bulk-comment-btn')).toBeInTheDocument();
      expect(screen.getByText('Bulk Comment')).toBeInTheDocument();
    });

    it('should not show Bulk Comment button when no items are selected', () => {
      const testData = createTestDataWithFailures(5);
      render(<FailureAnalysisProgress testData={testData} />);

      expect(screen.queryByTestId('floating-bulk-comment-btn')).not.toBeInTheDocument();
    });

    it('should open BulkCommentModal when Bulk Comment is clicked', () => {
      const testData = createTestDataWithFailures(5);
      render(<FailureAnalysisProgress testData={testData} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // select all
      fireEvent.click(screen.getByTestId('floating-bulk-comment-btn'));

      expect(screen.getByTestId('bulk-comment-modal')).toBeInTheDocument();
    });

    it('should close modal when Cancel is clicked', () => {
      const testData = createTestDataWithFailures(5);
      render(<FailureAnalysisProgress testData={testData} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(screen.getByTestId('floating-bulk-comment-btn'));

      expect(screen.getByTestId('bulk-comment-modal')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByTestId('bulk-comment-modal')).not.toBeInTheDocument();
    });

    it('should close modal via X button', () => {
      const testData = createTestDataWithFailures(3);
      render(<FailureAnalysisProgress testData={testData} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(screen.getByTestId('floating-bulk-comment-btn'));

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByTestId('bulk-comment-modal')).not.toBeInTheDocument();
    });

    it('should pass correct items count to the modal', () => {
      const testData = createTestDataWithFailures(5);
      render(<FailureAnalysisProgress testData={testData} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);
      fireEvent.click(checkboxes[2]);
      fireEvent.click(checkboxes[3]);

      fireEvent.click(screen.getByTestId('floating-bulk-comment-btn'));
      expect(screen.getByText(/Bulk Comment \(3 items\)/)).toBeInTheDocument();
    });

    it('should apply shared comment and show notes in UI', async () => {
      const user = userEvent.setup();
      const testData = createTestDataWithFailures(3);
      render(<FailureAnalysisProgress testData={testData} />);

      // Select first two items
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      await user.click(screen.getByTestId('floating-bulk-comment-btn'));

      const textarea = screen.getByTestId('shared-comment-input');
      await user.type(textarea, 'Bulk fix applied');

      await user.click(screen.getByTestId('apply-comments-btn'));

      // Modal should close
      expect(screen.queryByTestId('bulk-comment-modal')).not.toBeInTheDocument();

      // Notes should be visible in the UI for the updated items
      const noteElements = screen.getAllByText('Bulk fix applied');
      expect(noteElements.length).toBe(2);
    });

    it('should apply individual comments and show in UI', async () => {
      const user = userEvent.setup();
      const testData = createTestDataWithFailures(2);
      render(<FailureAnalysisProgress testData={testData} />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]); // select all

      await user.click(screen.getByTestId('floating-bulk-comment-btn'));
      await user.click(screen.getByTestId('mode-individual'));

      const textareas = screen.getAllByPlaceholderText('Enter comment for this test...');
      await user.type(textareas[0], 'Individual note X');

      await user.click(screen.getByTestId('apply-comments-btn'));

      expect(screen.queryByTestId('bulk-comment-modal')).not.toBeInTheDocument();

      // The note should appear in the UI
      expect(screen.getByText('Individual note X')).toBeInTheDocument();
    });

    it('should apply assignee only (no note, no status) and show it in the UI', async () => {
      const user = userEvent.setup();
      const testData = createTestDataWithFailures(2);
      render(<FailureAnalysisProgress testData={testData} />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]); // select all

      await user.click(screen.getByTestId('floating-bulk-comment-btn'));
      await user.type(screen.getByTestId('bulk-assignee-input'), 'Jane Smith');
      await user.click(screen.getByTestId('apply-comments-btn'));

      expect(screen.queryByTestId('bulk-comment-modal')).not.toBeInTheDocument();
      expect(screen.getAllByText('Jane Smith').length).toBe(2);
    });

    it('should apply status and assignee together with no note and show the assignee in the UI', async () => {
      const user = userEvent.setup();
      const testData = createTestDataWithFailures(2);
      render(<FailureAnalysisProgress testData={testData} />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]); // select all

      await user.click(screen.getByTestId('floating-bulk-comment-btn'));
      await user.selectOptions(screen.getByTestId('bulk-status-select'), 'completed');
      await user.type(screen.getByTestId('bulk-assignee-input'), 'Alex Rivera');
      await user.click(screen.getByTestId('apply-comments-btn'));

      expect(screen.queryByTestId('bulk-comment-modal')).not.toBeInTheDocument();
      expect(screen.getAllByText('Alex Rivera').length).toBe(2);
    });

    it('should clear selection after applying bulk comments', async () => {
      const user = userEvent.setup();
      const testData = createTestDataWithFailures(3);
      render(<FailureAnalysisProgress testData={testData} />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]); // select all
      // Both the inline "Select All" label and the floating bar show the count.
      expect(screen.getAllByText(/3 selected/)).toHaveLength(2);

      await user.click(screen.getByTestId('floating-bulk-comment-btn'));
      await user.type(screen.getByTestId('shared-comment-input'), 'done');
      await user.click(screen.getByTestId('apply-comments-btn'));

      expect(screen.queryByTestId('floating-bulk-comment-btn')).not.toBeInTheDocument();
    });

    it('should update timestamps when applying bulk comments', async () => {
      const user = userEvent.setup();
      const testData = createTestDataWithFailures(2);
      render(<FailureAnalysisProgress testData={testData} />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);

      await user.click(screen.getByTestId('floating-bulk-comment-btn'));
      await user.type(screen.getByTestId('shared-comment-input'), 'ts-check');
      await user.click(screen.getByTestId('apply-comments-btn'));

      // After applying, notes should be visible
      const noteElements = screen.getAllByText('ts-check');
      expect(noteElements.length).toBe(2);
      // Last Updated text should appear for items with notes
      expect(screen.getAllByText(/Last Updated:/).length).toBeGreaterThanOrEqual(1);
    });
  });
});
