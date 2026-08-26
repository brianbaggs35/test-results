import { useState, useMemo } from 'react';
import { AlertTriangleIcon, ClockIcon, CheckIcon } from 'lucide-react';
import { TestDetailsModal } from '../Dashboard/TestDetailsModal';
import { FilterControls } from '../Dashboard/FilterControls';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { TestData, TestCase } from '../../types';

interface TestWithSuite extends TestCase {
  suite: string;
}

interface FailureAnalysisPageProps {
  testData: TestData | null;
}

const PAGE_SIZE = 50;

export const FailureAnalysisPage: React.FC<FailureAnalysisPageProps> = ({
  testData
}) => {
  const [selectedTest, setSelectedTest] = useState<TestWithSuite | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('failed');
  const [suiteFilter, setSuiteFilter] = useState('all');
  const [classNameFilter, setClassNameFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Memoized computations that need to be before early returns
  const suites = useMemo(() => {
    if (!testData) return ['all'];
    return ['all', ...new Set(testData.suites.map(suite => suite.name))];
  }, [testData]);

  const classNames = useMemo(() => {
    if (!testData) return ['all'];
    return ['all', ...new Set(
      testData.suites
        .flatMap(suite => suite.testcases.map(test => test.classname))
        .filter((className): className is string => Boolean(className))
    )];
  }, [testData]);

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('failed');
    setSuiteFilter('all');
    setClassNameFilter('all');
    setCurrentPage(1);
  };

  const filteredTests = useMemo(() => {
    if (!testData) return [];
    return testData.suites
      .flatMap(suite =>
        suite.testcases
          .filter(test => test.status === 'failed')
          .map(test => ({
            ...test,
            suite: suite.name
          } as TestWithSuite))
      )
      .filter(test => {
        if (suiteFilter !== 'all' && test.suite !== suiteFilter) return false;
        if (classNameFilter !== 'all' && test.classname !== classNameFilter) return false;
        if (searchTerm &&
            !test.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !test.suite.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
      });
  }, [testData, suiteFilter, classNameFilter, searchTerm]);

  if (!testData) {
    return (
      <EmptyState
        icon={AlertTriangleIcon}
        title="No Test Data Available"
        description="Please upload a JUnit XML file from the Dashboard to view failure analysis."
      />
    );
  }

  // Reset to page 1 when filters change
  const totalPages = Math.ceil(filteredTests.length / PAGE_SIZE);
  const validCurrentPage = Math.min(currentPage, Math.max(1, totalPages));
  if (validCurrentPage !== currentPage) {
    setCurrentPage(validCurrentPage);
  }

  // Paginate the filtered tests
  const startIndex = (validCurrentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedTests = filteredTests.slice(startIndex, endIndex);
  if (filteredTests.length === 0) {
    return (
      <EmptyState
        variant="success"
        icon={CheckIcon}
        title="All Tests Passed"
        description="No failures were detected in this test run."
      />
    );
  }
  return <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground">Failure Analysis</h2>
          <p className="text-sm text-muted-foreground">
            {filteredTests.length} failed test
            {filteredTests.length > 1 ? 's' : ''} detected
            {filteredTests.length > PAGE_SIZE && (
              <span className="ml-2">
                (Showing {startIndex + 1}-{Math.min(endIndex, filteredTests.length)} of {filteredTests.length})
              </span>
            )}
          </p>
        </CardHeader>
        <CardContent>
          <FilterControls searchTerm={searchTerm} setSearchTerm={setSearchTerm} statusFilter={statusFilter} setStatusFilter={setStatusFilter} suiteFilter={suiteFilter} setSuiteFilter={setSuiteFilter} classNameFilter={classNameFilter} setClassNameFilter={setClassNameFilter} showFilters={showFilters} setShowFilters={setShowFilters} suites={suites} classNames={classNames} resetFilters={resetFilters} />
          <div className="grid gap-3">
            {paginatedTests.map((test, index) => <button key={index} className="w-full text-left rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors" onClick={() => setSelectedTest(test)}>
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <AlertTriangleIcon className="w-5 h-5 text-destructive" />
                      <div>
                        <h4 className="text-lg font-medium text-foreground">
                          {test.name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Suite: {test.suite}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <ClockIcon className="w-4 h-4 mr-1" />
                      {test.time.toFixed(2)}s
                    </div>
                  </div>
                </div>
              </button>)}
          </div>

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
      {selectedTest && <TestDetailsModal test={selectedTest} onClose={() => setSelectedTest(null)} />}
    </div>;
};
