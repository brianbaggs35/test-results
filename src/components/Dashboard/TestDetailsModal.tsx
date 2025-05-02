import React from 'react';
import { XIcon, ClockIcon, CheckCircleIcon, AlertCircleIcon, XCircleIcon, FileTextIcon, CodeIcon } from 'lucide-react';
interface TestDetailsModalProps {
  test: any;
  onClose: () => void;
}
export const TestDetailsModal = ({
  test,
  onClose
}: TestDetailsModalProps) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircleIcon className="w-5 h-5 text-yellow-500" />;
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    }
  };
  const formatStackTrace = (errorMessage: string) => {
    if (!errorMessage) return null;
    // Split message and stack trace if they exist
    const parts = errorMessage.split('\n');
    const message = parts[0];
    const stack = parts.slice(1).join('\n');
    return {
      message,
      stack: stack.trim()
    };
  };
  const formatFailureDetails = (details: any) => {
    if (!details) return null;
    return {
      message: details.message || '',
      type: details.type || '',
      stackTrace: details.stackTrace || ''
    };
  };
  const error = test.errorMessage ? formatStackTrace(test.errorMessage) : null;
  const failureDetails = test.failureDetails ? formatFailureDetails(test.failureDetails) : null;
  return <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-xl font-semibold text-gray-900">Test Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 transition-colors">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="px-6 py-4">
          <div className="space-y-6">
            {/* Test Name and Status */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-1">
                Test Name
              </h4>
              <p className="text-lg font-semibold text-gray-900">{test.name}</p>
              <div className="mt-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full border ${getStatusColor(test.status)}`}>
                  {getStatusIcon(test.status)}
                  <span className="ml-2 font-medium">
                    {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                  </span>
                </span>
              </div>
            </div>
            {/* Test Suite and Class Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">
                  Test Suite
                </h4>
                <div className="flex items-center">
                  <FileTextIcon className="w-4 h-4 text-blue-500 mr-2" />
                  <p className="text-gray-900">{test.suite}</p>
                </div>
              </div>
              {test.classname && <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">
                    Class Name
                  </h4>
                  <div className="flex items-center">
                    <CodeIcon className="w-4 h-4 text-purple-500 mr-2" />
                    <p className="text-gray-900">{test.classname}</p>
                  </div>
                </div>}
            </div>
            {/* Execution Time */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-1">
                Execution Time
              </h4>
              <div className="flex items-center text-gray-900">
                <ClockIcon className="w-4 h-4 text-blue-500 mr-2" />
                <span>{parseFloat(test.time).toFixed(2)} seconds</span>
              </div>
            </div>
            {/* Error Details */}
            {test.status === 'failed' && <div className="space-y-4">
                {error && <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">
                      Error Summary
                    </h4>
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                      <p className="text-red-700 text-sm font-medium">
                        {error.message}
                      </p>
                    </div>
                  </div>}
                {failureDetails && <>
                    {failureDetails.type && <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2">
                          Failure Type
                        </h4>
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                          <p className="text-gray-700 text-sm font-medium">
                            {failureDetails.type}
                          </p>
                        </div>
                      </div>}
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">
                        Stack Trace
                      </h4>
                      <div className="bg-gray-800 rounded-md overflow-x-auto">
                        <pre className="p-4 text-sm">
                          <code className="text-gray-200 font-mono whitespace-pre">
                            {failureDetails.stackTrace || error?.stack}
                          </code>
                        </pre>
                      </div>
                    </div>
                  </>}
              </div>}
          </div>
        </div>
      </div>
    </div>;
};