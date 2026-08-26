import { useEffect, useState, useMemo, useRef } from 'react';
import { AlertTriangleIcon, AlertCircleIcon, DownloadIcon, UploadIcon, CheckCircleIcon } from 'lucide-react';
import { TestDetailsModal } from '../Dashboard/TestDetailsModal';
import { FilterControls } from '../Dashboard/FilterControls';
import ClearLocalStorageButton from '../Dashboard/ClearLocalStorage';
import { BulkCommentModal, type BulkCommentResult } from './BulkCommentModal';
import { FloatingBulkActionsBar } from './FloatingBulkActionsBar';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { TestData, TestCase, FailureProgressItem } from '../../types';
import { exportProgressBundle, importProgressBundle } from '../../utils/exportBundle';
import { testIdentityKey } from '../../utils/testIdentity';

interface FailureAnalysisProgressProps {
  testData: TestData | null;
}

const PAGE_SIZE = 50;

const STATUS_BORDER: Record<string, string> = {
  completed: 'border-success/30 bg-success/5',
  in_progress: 'border-primary/30 bg-primary/5',
  pending: 'border-destructive/30 bg-destructive/5',
};

export const FailureAnalysisProgress: React.FC<FailureAnalysisProgressProps> = ({
  testData
}) => {
  const [progressData, setProgressData] = useState<{
    [key: string]: FailureProgressItem;
  }>({});
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [assignee, setAssignee] = useState('');
  const [showStackTrace, setShowStackTrace] = useState<TestCase | null>(null);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [suiteFilter, setSuiteFilter] = useState('all');
  const [classNameFilter, setClassNameFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Bulk actions state
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [showBulkCommentModal, setShowBulkCommentModal] = useState(false);

  // Import progress state
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!testData) return;

    // Load progress data from localStorage
    const savedProgress = localStorage.getItem('testFixProgress');
    if (savedProgress) {
      setProgressData(JSON.parse(savedProgress));
    } else {
      // Initialize progress data for failed tests
      const initialProgress: { [key: string]: FailureProgressItem } = {};
      testData.suites.forEach(suite => {
        suite.testcases.filter(test => test.status === 'failed').forEach(test => {
          const id = testIdentityKey(suite.name, test.classname, test.name);
          initialProgress[id] = {
            id,
            name: test.name,
            suite: suite.name,
            errorMessage: test.errorMessage || undefined,
            status: 'pending',
            notes: '',
            updatedAt: new Date().toISOString()
          };
        });
      });
      setProgressData(initialProgress);
      localStorage.setItem('testFixProgress', JSON.stringify(initialProgress));
    }
  }, [testData]);
  const updateTestStatus = (testId: string, status: 'pending' | 'in_progress' | 'completed') => {
    const updatedProgress = {
      ...progressData,
      [testId]: {
        ...progressData[testId],
        status,
        updatedAt: new Date().toISOString(),
        notes: notes || progressData[testId].notes,
        assignee: assignee || progressData[testId].assignee
      }
    };
    setProgressData(updatedProgress);
    localStorage.setItem('testFixProgress', JSON.stringify(updatedProgress));
    setSelectedTest(null);
    setNotes('');
    setAssignee('');
  };

  // Bulk update function
  const updateBulkTestStatus = (testIds: string[], status: 'pending' | 'in_progress' | 'completed') => {
    const updatedProgress = { ...progressData };
    testIds.forEach(testId => {
      updatedProgress[testId] = {
        ...updatedProgress[testId],
        status,
        updatedAt: new Date().toISOString()
      };
    });
    setProgressData(updatedProgress);
    localStorage.setItem('testFixProgress', JSON.stringify(updatedProgress));
    setSelectedTests(new Set()); // Clear selection after bulk update
  };

  // Bulk comment handler
  const applyBulkComments = (result: BulkCommentResult) => {
    const updatedProgress = { ...progressData };
    Object.entries(result.comments).forEach(([testId, comment]) => {
      if (updatedProgress[testId]) {
        const individualAssignee = result.individualAssignees?.[testId];
        const individualStatus = result.individualStatuses?.[testId];
        updatedProgress[testId] = {
          ...updatedProgress[testId],
          notes: comment || updatedProgress[testId].notes,
          assignee: individualAssignee ?? result.assignee ?? updatedProgress[testId].assignee,
          status: individualStatus ?? result.status ?? updatedProgress[testId].status,
          updatedAt: new Date().toISOString()
        };
      }
    });
    setProgressData(updatedProgress);
    localStorage.setItem('testFixProgress', JSON.stringify(updatedProgress));
    setShowBulkCommentModal(false);
    setSelectedTests(new Set());
  };

  // Import progress handler
  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !testData) return;
    setImportError(null);
    setImportSummary(null);
    try {
      const { progress, matchedCount, skippedCount } = await importProgressBundle(file, testData, progressData);
      setProgressData(progress);
      localStorage.setItem('testFixProgress', JSON.stringify(progress));
      setSelectedTest(null);
      setNotes('');
      setAssignee('');
      setSelectedTests(new Set());
      setCurrentPage(1);
      setImportSummary(
        `Imported progress for ${matchedCount} test${matchedCount !== 1 ? 's' : ''}.` +
          (skippedCount > 0
            ? ` ${skippedCount} ${skippedCount !== 1 ? 'entries' : 'entry'} in the file didn't match a test in the currently loaded results and ${skippedCount !== 1 ? 'were' : 'was'} skipped.`
            : '')
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : `Failed to import "${file.name}".`);
    }
  };
  const failedTests = Object.values(progressData);
  const totalTests = failedTests.length;
  const completedTests = failedTests.filter(test => test.status === 'completed').length;
  const inProgressTests = failedTests.filter(test => test.status === 'in_progress').length;

  // Get unique values for filters
  const suites = ['all', ...new Set(failedTests.map(test => test.suite))];
  const classNames = ['all']; // Progress doesn't track classnames, so just show 'all'

  // Custom status options for progress tracking
  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' }
  ];

  // Reset filters function
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSuiteFilter('all');
    setClassNameFilter('all');
    setCurrentPage(1);
  };

  // Filter tests based on search and filter criteria (memoized to prevent infinite re-renders)
  const filteredTests = useMemo(() => {
    return failedTests.filter(test => {
      // Status filter
      if (statusFilter !== 'all' && test.status !== statusFilter) return false;

      // Suite filter
      if (suiteFilter !== 'all' && test.suite !== suiteFilter) return false;

      // Search term (search in name, suite, error message, notes, and assignee)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesName = test.name.toLowerCase().includes(searchLower);
        const matchesSuite = test.suite.toLowerCase().includes(searchLower);
        const matchesError = test.errorMessage?.toLowerCase().includes(searchLower);
        const matchesNotes = test.notes?.toLowerCase().includes(searchLower);
        const matchesAssignee = test.assignee?.toLowerCase().includes(searchLower);

        if (!matchesName && !matchesSuite && !matchesError && !matchesNotes && !matchesAssignee) {
          return false;
        }
      }

      return true;
    });
  }, [failedTests, statusFilter, suiteFilter, searchTerm]);

  // Reset to page 1 when filters change
  const totalPages = Math.ceil(filteredTests.length / PAGE_SIZE);
  const validCurrentPage = Math.min(currentPage, Math.max(1, totalPages));
  if (validCurrentPage !== currentPage) {
    setCurrentPage(validCurrentPage);
  }

  // Paginate the filtered tests (memoized to prevent infinite re-renders)
  const paginationData = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const paginatedTests = filteredTests.slice(startIndex, endIndex);
    return { startIndex, endIndex, paginatedTests };
  }, [filteredTests, validCurrentPage]);

  const { startIndex, endIndex, paginatedTests } = paginationData;

  // Reset selectedTests when page changes (not when paginatedTests changes)
  useEffect(() => {
    setSelectedTests(new Set());
  }, [validCurrentPage]);
  // Selection functions (after paginatedTests is defined)
  const toggleTestSelection = (testId: string) => {
    const newSelection = new Set(selectedTests);
    if (newSelection.has(testId)) {
      newSelection.delete(testId);
    } else {
      newSelection.add(testId);
    }
    setSelectedTests(newSelection);
  };

  const toggleSelectAll = () => {
    if (paginatedTests.every(test => selectedTests.has(test.id))) {
      // If all visible tests are selected, deselect all
      setSelectedTests(new Set());
    } else {
      // Select all visible tests
      setSelectedTests(new Set(paginatedTests.map(test => test.id)));
    }
  };

  const clearSelection = () => {
    setSelectedTests(new Set());
  };

  const handleShowStackTrace = (test: FailureProgressItem) => {
    if (!testData) return;

    // Find the original test data to get all details
    const suite = testData.suites.find(s => s.name === test.suite);
    const testDetails = suite?.testcases.find(t => t.name === test.name);
    if (!testDetails) return;
    // Create a complete test object with all necessary fields
    const modalTest: TestCase = {
      ...testDetails,
      suite: test.suite,
      status: 'failed' as const,
      errorMessage: testDetails.errorMessage || test.errorMessage,
      failureDetails: testDetails.failureDetails || {
        message: testDetails.errorMessage || test.errorMessage || 'Unknown error',
        type: 'Error',
        stackTrace: testDetails.errorMessage || test.errorMessage || 'No stack trace available'
      }
    };
    setShowStackTrace(modalTest);
  };

  if (!testData) {
    return (
      <EmptyState
        icon={AlertTriangleIcon}
        title="No Test Data Available"
        description="Please upload a JUnit XML file from the Dashboard to view failure resolution progress."
      />
    );
  }

  return <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
          <h2 className="text-2xl font-bold text-foreground">
            Failure Resolution Progress
          </h2>
          <div className="flex items-center gap-2">
            <ClearLocalStorageButton />
            <input
              id="import-progress-upload"
              name="importProgressUpload"
              type="file"
              ref={importInputRef}
              onChange={handleImportFileChange}
              accept=".json"
              className="hidden"
              aria-label="Upload progress export file"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => importInputRef.current?.click()}
              disabled={totalTests === 0}
              title="Load a previously exported progress JSON file to restore your notes, status, and assignees"
            >
              <UploadIcon className="size-4" />
              Import Progress
            </Button>
            <Button
              size="sm"
              onClick={() => exportProgressBundle(testData, progressData)}
              disabled={totalTests === 0}
              title="Download this data plus your progress notes, to merge with a teammate's work later on the Split tab"
            >
              <DownloadIcon className="size-4" />
              Export Progress
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {importError && (
            <Alert variant="destructive" className="mb-4" data-testid="import-progress-error">
              <AlertCircleIcon className="size-4" />
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}
          {importSummary && (
            <Alert className="mb-4 border-success/30 bg-success/5 text-success [&>svg]:text-success" data-testid="import-progress-summary">
              <CheckCircleIcon className="size-4" />
              <AlertDescription className="text-success">{importSummary}</AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-muted-foreground mb-4">
            {filteredTests.length} test{filteredTests.length !== 1 ? 's' : ''} tracked
            {filteredTests.length > PAGE_SIZE && (
              <span className="ml-2">
                (Showing {startIndex + 1}-{Math.min(endIndex, filteredTests.length)} of {filteredTests.length})
              </span>
            )}
          </p>
          {/* Progress Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-muted/40">
              <CardContent className="flex justify-between items-center py-4">
                <span className="text-muted-foreground">Total Failed Tests</span>
                <span className="text-xl font-bold text-foreground">
                  {totalTests}
                </span>
              </CardContent>
            </Card>
            <Card className="bg-success/5 border-success/20">
              <CardContent className="flex justify-between items-center py-4">
                <span className="text-success">Completed</span>
                <span className="text-xl font-bold text-success">
                  {completedTests}
                </span>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="flex justify-between items-center py-4">
                <span className="text-primary">In Progress</span>
                <span className="text-xl font-bold text-primary">
                  {inProgressTests}
                </span>
              </CardContent>
            </Card>
          </div>
          {/* Progress Bar */}
          <Progress value={totalTests > 0 ? (completedTests / totalTests * 100) : 0} className="mb-6 [&>div]:bg-success" />

          {/* Filter Controls */}
          <FilterControls
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            suiteFilter={suiteFilter}
            setSuiteFilter={setSuiteFilter}
            classNameFilter={classNameFilter}
            setClassNameFilter={setClassNameFilter}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            suites={suites}
            classNames={classNames}
            resetFilters={resetFilters}
            statusOptions={statusOptions}
          />

          {/* Select all row - bulk action buttons (including Bulk Comment) live on the floating bar below */}
          {paginatedTests.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4 mb-4">
              <Label className="flex items-center gap-2 font-medium">
                <Checkbox
                  id="select-all-tests"
                  checked={selectedTests.size === paginatedTests.length && paginatedTests.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                Select All ({selectedTests.size} selected)
              </Label>
            </div>
          )}

          {/* Failed Tests List */}
          <div className="space-y-4">
            {paginatedTests.map(test => {
              const safeId = test.id.replace(/\s+/g, '_');
              return <div key={test.id} className={cn('border rounded-lg overflow-hidden', STATUS_BORDER[test.status])}>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedTests.has(test.id)}
                        onCheckedChange={() => toggleTestSelection(test.id)}
                        aria-label={`Select ${test.name}`}
                      />
                      <StatusBadge status={test.status} compact />
                      <div>
                        <h4 className="text-lg font-medium text-foreground">
                          {test.name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Suite: {test.suite}
                        </p>
                      </div>
                    </div>
                    {selectedTest !== test.id ? <Button variant="outline" size="sm" onClick={() => {
                        setSelectedTest(test.id);
                        setNotes(progressData[test.id]?.notes || '');
                        setAssignee(progressData[test.id]?.assignee || '');
                      }}>
                        Edit
                      </Button> : <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => updateTestStatus(test.id, 'pending')}>
                          Pending
                        </Button>
                        <Button size="sm" variant="outline" className="text-primary hover:text-primary" onClick={() => updateTestStatus(test.id, 'in_progress')}>
                          In Progress
                        </Button>
                        <Button size="sm" variant="outline" className="text-success hover:text-success" onClick={() => updateTestStatus(test.id, 'completed')}>
                          Complete
                        </Button>
                      </div>}
                  </div>
                  {/* Add Stack Trace button */}
                  <div className="mt-2 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => handleShowStackTrace(test)}>
                      View Stack Trace
                    </Button>
                  </div>
                  {selectedTest === test.id && <div className="mt-4 space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor={`assignee-${safeId}`}>Assignee</Label>
                        <Input id={`assignee-${safeId}`} name={`assignee-${safeId}`} type="text" value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="Who is working on this?" className="bg-background" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`notes-${safeId}`}>Notes</Label>
                        <Textarea id={`notes-${safeId}`} name={`notes-${safeId}`} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add any notes about the fix..." className="bg-background" rows={3} />
                      </div>
                    </div>}
                  {!selectedTest && (test.notes || test.assignee) && <div className="mt-2 text-sm text-muted-foreground">
                      {test.notes && <p>
                        <strong className="text-foreground">Notes:</strong> {test.notes}
                      </p>}
                      {test.assignee && <p>
                          <strong className="text-foreground">Assignee:</strong> {test.assignee}
                        </p>}
                      <p>
                        <strong className="text-foreground">Last Updated:</strong>{' '}
                        {new Date(test.updatedAt || new Date()).toLocaleString()}
                      </p>
                    </div>}
                </div>
              </div>})}
          </div>

          {/* Pagination Controls */}
          {filteredTests.length > PAGE_SIZE && (
            <div className="mt-6">
              <Pagination
                currentPage={validCurrentPage}
                totalPages={totalPages}
                totalItems={filteredTests.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
      {/* Stack Trace Modal */}
      {showStackTrace && <TestDetailsModal test={showStackTrace} onClose={() => setShowStackTrace(null)} />}

      {/* Bulk Comment Modal */}
      {showBulkCommentModal && (
        <BulkCommentModal
          selectedItems={Array.from(selectedTests)
            .map(id => progressData[id])
            .filter(Boolean)}
          onApply={applyBulkComments}
          onClose={() => setShowBulkCommentModal(false)}
        />
      )}

      {/* Floating Bulk Actions Bar */}
      <FloatingBulkActionsBar
        selectedCount={selectedTests.size}
        totalCount={paginatedTests.length}
        allSelected={paginatedTests.length > 0 && paginatedTests.every(test => selectedTests.has(test.id))}
        onToggleSelectAll={toggleSelectAll}
        onMarkPending={() => updateBulkTestStatus(Array.from(selectedTests), 'pending')}
        onMarkInProgress={() => updateBulkTestStatus(Array.from(selectedTests), 'in_progress')}
        onMarkComplete={() => updateBulkTestStatus(Array.from(selectedTests), 'completed')}
        onBulkComment={() => setShowBulkCommentModal(true)}
        onClearSelection={clearSelection}
      />
    </div>;
};
