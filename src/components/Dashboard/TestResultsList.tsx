import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import { TestDetailsModal } from './TestDetailsModal';
import { FilterControls } from './FilterControls';
import type { TestData, TestCase } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Pagination } from '@/components/shared/Pagination';
import { FloatingScrollbar } from '@/components/shared/FloatingScrollbar';

interface TestWithSuite extends TestCase {
  suite: string;
}

interface TestResultsListProps {
  testData: TestData;
}

const PAGE_SIZE = 50;

export const TestResultsList: React.FC<TestResultsListProps> = ({
  testData
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<keyof TestWithSuite>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filteredTests, setFilteredTests] = useState<TestWithSuite[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTest, setSelectedTest] = useState<TestWithSuite | null>(null);
  const [suiteFilter, setSuiteFilter] = useState('all');
  const [classNameFilter, setClassNameFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Get unique values for filters
  const suites = ['all', ...new Set(testData.suites.map(suite => suite.name))];
  const classNames = ['all', ...new Set(
    testData.suites
      .flatMap(suite => suite.testcases.map(test => test.classname))
      .filter((className): className is string => Boolean(className))
  )];
  // Flatten test cases from all suites
  useEffect(() => {
    const flattenedTests = testData.suites.flatMap(suite => suite.testcases.map(test => ({
      ...test,
      suite: suite.name
    })));
    // Apply all filters
    let filtered = [...flattenedTests];
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(test => test.status === statusFilter);
    }
    // Apply suite filter
    if (suiteFilter !== 'all') {
      filtered = filtered.filter(test => test.suite === suiteFilter);
    }
    // Apply class name filter
    if (classNameFilter !== 'all') {
      filtered = filtered.filter(test => test.classname === classNameFilter);
    }
    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(test => test.name.toLowerCase().includes(term) || test.suite.toLowerCase().includes(term) || test.classname && test.classname.toLowerCase().includes(term));
    }
    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'suite') {
        comparison = a.suite.localeCompare(b.suite);
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status);
      } else if (sortField === 'time') {
        comparison = a.time - b.time;
      } else if (sortField === 'classname') {
        comparison = (a.classname || '').localeCompare(b.classname || '');
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    setFilteredTests(filtered);
    setCurrentPage(1);
  }, [testData, searchTerm, statusFilter, suiteFilter, classNameFilter, sortField, sortDirection]);

  const handleSort = (field: keyof TestWithSuite) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSuiteFilter('all');
    setClassNameFilter('all');
  };

  const totalPages = Math.max(1, Math.ceil(filteredTests.length / PAGE_SIZE));
  const paginatedTests = filteredTests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const sortIndicator = (field: keyof TestWithSuite) => {
    if (sortField !== field) return <ChevronsUpDownIcon className="size-3.5 text-muted-foreground/50" />;
    return sortDirection === 'asc' ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />;
  };

  const sortableHeader = (field: keyof TestWithSuite, label: string) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 font-medium hover:text-foreground"
    >
      {label}
      {sortIndicator(field)}
    </button>
  );

  return <Card>
      <CardHeader>
        <CardTitle>Test Results</CardTitle>
      </CardHeader>
      <CardContent>
        <FilterControls searchTerm={searchTerm} setSearchTerm={setSearchTerm} statusFilter={statusFilter} setStatusFilter={setStatusFilter} suiteFilter={suiteFilter} setSuiteFilter={setSuiteFilter} classNameFilter={classNameFilter} setClassNameFilter={setClassNameFilter} showFilters={showFilters} setShowFilters={setShowFilters} suites={suites} classNames={classNames} resetFilters={resetFilters} />
        <Table wrapperRef={tableScrollRef} wrapperClassName="rounded-lg border">
          <TableHeader>
            <TableRow>
              <TableHead>{sortableHeader('name', 'Test Name')}</TableHead>
              <TableHead>{sortableHeader('suite', 'Suite')}</TableHead>
              <TableHead>{sortableHeader('classname', 'Class Name')}</TableHead>
              <TableHead className="w-32">{sortableHeader('status', 'Status')}</TableHead>
              <TableHead className="w-32">{sortableHeader('time', 'Duration')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTests.length > 0 ? paginatedTests.map((test, index) => <TableRow key={index} onClick={() => setSelectedTest(test)} className={test.status === 'failed' ? 'bg-destructive/5 cursor-pointer' : 'cursor-pointer'}>
                  <TableCell className="font-medium text-foreground">
                    {test.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {test.suite}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {test.classname || '-'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={test.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {test.time.toFixed(2)}s
                  </TableCell>
                </TableRow>) : <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No test results match your filters.
                </TableCell>
              </TableRow>}
          </TableBody>
        </Table>
        <div className="mt-4 text-sm text-muted-foreground">
          Showing {filteredTests.length} of {testData.summary.total} tests
        </div>
        {totalPages > 1 && (
          <div className="mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredTests.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </CardContent>
      {selectedTest && <TestDetailsModal test={selectedTest} onClose={() => setSelectedTest(null)} />}
      <FloatingScrollbar targetRef={tableScrollRef} />
    </Card>;
};
