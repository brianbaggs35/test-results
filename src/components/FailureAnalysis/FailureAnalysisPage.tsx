import React, { useState } from 'react';
import { AlertTriangleIcon, ClockIcon, CheckIcon } from 'lucide-react';
import { TestDetailsModal } from '../Dashboard/TestDetailsModal';
import { FilterControls } from '../Dashboard/FilterControls';
export const FailureAnalysisPage = ({
  testData
}) => {
  const [selectedTest, setSelectedTest] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('failed');
  const [suiteFilter, setSuiteFilter] = useState('all');
  const [classNameFilter, setClassNameFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  if (!testData) {
    return <div className="bg-white p-8 rounded-lg shadow text-center">
        <AlertTriangleIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          No Test Data Available
        </h2>
        <p className="text-gray-600 mb-6">
          Please upload a JUnit XML file from the Dashboard to view failure
          analysis.
        </p>
      </div>;
  }
  const suites = ['all', ...new Set(testData.suites.map(suite => suite.name))];
  const classNames = ['all', ...new Set(testData.suites.flatMap(suite => suite.testcases.map(test => test.classname)).filter(Boolean))];
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('failed');
    setSuiteFilter('all');
    setClassNameFilter('all');
  };
  const filteredTests = testData.suites.flatMap(suite => suite.testcases.filter(test => test.status === 'failed').map(test => ({
    ...test,
    suite: suite.name
  }))).filter(test => {
    if (suiteFilter !== 'all' && test.suite !== suiteFilter) return false;
    if (classNameFilter !== 'all' && test.classname !== classNameFilter) return false;
    if (searchTerm && !test.name.toLowerCase().includes(searchTerm.toLowerCase()) && !test.suite.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });
  if (filteredTests.length === 0) {
    return <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <CheckIcon className="h-8 w-8 text-green-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-green-800">
              All Tests Passed
            </h3>
            <p className="mt-2 text-green-700">
              No failures were detected in this test run.
            </p>
          </div>
        </div>
      </div>;
  }
  return <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Failure Analysis</h2>
          <p className="text-sm text-gray-500 mt-1">
            {filteredTests.length} failed test
            {filteredTests.length > 1 ? 's' : ''} detected
          </p>
        </div>
        <FilterControls searchTerm={searchTerm} setSearchTerm={setSearchTerm} statusFilter={statusFilter} setStatusFilter={setStatusFilter} suiteFilter={suiteFilter} setSuiteFilter={setSuiteFilter} classNameFilter={classNameFilter} setClassNameFilter={setClassNameFilter} showFilters={showFilters} setShowFilters={setShowFilters} suites={suites} classNames={classNames} resetFilters={resetFilters} />
        <div className="grid gap-4">
          {filteredTests.map((test, index) => <button key={index} className="w-full text-left bg-white border border-red-200 rounded-lg overflow-hidden hover:bg-red-50 transition-colors" onClick={() => setSelectedTest(test)}>
              <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <AlertTriangleIcon className="w-5 h-5 text-red-500" />
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">
                        {test.name}
                      </h4>
                      <p className="text-sm text-gray-500">
                        Suite: {test.suite}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <ClockIcon className="w-4 h-4 mr-1" />
                    {parseFloat(test.time).toFixed(2)}s
                  </div>
                </div>
              </div>
            </button>)}
        </div>
      </div>
      {selectedTest && <TestDetailsModal test={selectedTest} onClose={() => setSelectedTest(null)} />}
    </div>;
};