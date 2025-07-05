import { AlertTriangleIcon, ClockIcon, CheckIcon } from 'lucide-react';
import type { TestData } from '../../types';

interface FailureAnalysisProps {
  testData: TestData;
}

export const FailureAnalysis: React.FC<FailureAnalysisProps> = ({
  testData
}) => {
  const failedTests = testData.suites.flatMap(suite =>
    suite.testcases
      .filter(test => test.status === 'failed')
      .map(test => ({
        ...test,
        suite: suite.name
      }))
  );
  if (failedTests.length === 0) {
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Failure Analysis
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {failedTests.length} failed test{failedTests.length > 1 ? 's' : ''}{' '}
            detected
          </p>
        </div>
      </div>
      <div className="grid gap-6">
        {failedTests.map((test, index) => (
          <div key={`${test.suite}-${test.name}-${index}`} className="bg-white border border-red-200 rounded-lg overflow-hidden">
            <div className="bg-red-50 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <AlertTriangleIcon className="w-5 h-5 text-red-500" />
                  <h4 className="text-lg font-medium text-gray-900">
                    {test.name}
                  </h4>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <ClockIcon className="w-4 h-4 mr-1" />
                  {test.time.toFixed(2)}s
                </div>
              </div>
              <p className="mt-1 text-sm text-gray-500">Suite: {test.suite}</p>
            </div>
            <div className="px-6 py-4">
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-500 mb-2">
                  Error Message
                </h5>
                <pre className="bg-red-50 p-4 rounded-md text-red-700 text-sm whitespace-pre-wrap font-mono">
                  {test.errorMessage || 'No error message provided'}
                </pre>
              </div>
              {test.classname && <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-1">
                    Class Name
                  </h5>
                  <p className="text-sm text-gray-900">{test.classname}</p>
                </div>}
            </div>
          </div>
        ))}
      </div>
    </div>;
};