import { useEffect, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, CheckIcon, XIcon, AlertCircleIcon } from 'lucide-react';
import { TestDetailsModal } from './TestDetailsModal';
import { FilterControls } from './FilterControls';
import type { TestData, TestCase } from '../../types';

interface TestWithSuite extends TestCase {
  suite: string;
}

interface TestResultsListProps {
  testData: TestData;
}

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
  }, [testData, searchTerm, statusFilter, suiteFilter, classNameFilter, sortField, sortDirection]);
  
  const handleSort = (field: keyof TestWithSuite) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckIcon className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XIcon className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircleIcon className="w-5 h-5 text-yellow-500" />;
    }
  };
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSuiteFilter('all');
    setClassNameFilter('all');
  };
  return <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Test Results</h3>
      <FilterControls searchTerm={searchTerm} setSearchTerm={setSearchTerm} statusFilter={statusFilter} setStatusFilter={setStatusFilter} suiteFilter={suiteFilter} setSuiteFilter={setSuiteFilter} classNameFilter={classNameFilter} setClassNameFilter={setClassNameFilter} showFilters={showFilters} setShowFilters={setShowFilters} suites={suites} classNames={classNames} resetFilters={resetFilters} />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('name')}>
                <div className="flex items-center">
                  Test Name
                  {sortField === 'name' && (sortDirection === 'asc' ? <ChevronUpIcon className="w-4 h-4 ml-1" /> : <ChevronDownIcon className="w-4 h-4 ml-1" />)}
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('suite')}>
                <div className="flex items-center">
                  Suite
                  {sortField === 'suite' && (sortDirection === 'asc' ? <ChevronUpIcon className="w-4 h-4 ml-1" /> : <ChevronDownIcon className="w-4 h-4 ml-1" />)}
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('classname')}>
                <div className="flex items-center">
                  Class Name
                  {sortField === 'classname' && (sortDirection === 'asc' ? <ChevronUpIcon className="w-4 h-4 ml-1" /> : <ChevronDownIcon className="w-4 h-4 ml-1" />)}
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer w-32" onClick={() => handleSort('status')}>
                <div className="flex items-center">
                  Status
                  {sortField === 'status' && (sortDirection === 'asc' ? <ChevronUpIcon className="w-4 h-4 ml-1" /> : <ChevronDownIcon className="w-4 h-4 ml-1" />)}
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer w-32" onClick={() => handleSort('time')}>
                <div className="flex items-center">
                  Duration
                  {sortField === 'time' && (sortDirection === 'asc' ? <ChevronUpIcon className="w-4 h-4 ml-1" /> : <ChevronDownIcon className="w-4 h-4 ml-1" />)}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTests.length > 0 ? filteredTests.map((test, index) => <tr key={index} onClick={() => setSelectedTest(test)} className={`${test.status === 'failed' ? 'bg-red-50' : ''} hover:bg-gray-50 cursor-pointer transition-colors`}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {test.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {test.suite}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {test.classname || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(test.status)}
                      <span className={`ml-2 text-sm ${test.status === 'passed' ? 'text-green-800' : test.status === 'failed' ? 'text-red-800' : 'text-yellow-800'}`}>
                        {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {test.time.toFixed(2)}s
                  </td>
                </tr>) : <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  No test results match your filters.
                </td>
              </tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-sm text-gray-500">
        Showing {filteredTests.length} of {testData.summary.total} tests
      </div>
      {selectedTest && <TestDetailsModal test={selectedTest} onClose={() => setSelectedTest(null)} />}
    </div>;
};