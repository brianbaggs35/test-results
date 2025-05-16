import React, { useEffect, useState } from 'react';
import { CheckCircleIcon, XCircleIcon, AlertTriangleIcon, ClockIcon, CheckIcon, FileTextIcon, CodeIcon } from 'lucide-react';
import { TestDetailsModal } from '../Dashboard/TestDetailsModal';
interface FailureProgressItem {
  id: string;
  name: string;
  suite: string;
  errorMessage?: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
  updatedAt?: string;
  assignee?: string;
}
export const FailureAnalysisProgress = ({
  testData
}) => {
  const [progressData, setProgressData] = useState<{
    [key: string]: FailureProgressItem;
  }>({});
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [assignee, setAssignee] = useState('');
  const [showStackTrace, setShowStackTrace] = useState<string | null>(null);
  useEffect(() => {
    // Load progress data from localStorage
    const savedProgress = localStorage.getItem('testFixProgress');
    if (savedProgress) {
      setProgressData(JSON.parse(savedProgress));
    } else {
      // Initialize progress data for failed tests
      const initialProgress = {};
      testData.suites.forEach(suite => {
        suite.testcases.filter(test => test.status === 'failed').forEach(test => {
          const id = `${suite.name}-${test.name}`;
          initialProgress[id] = {
            id,
            name: test.name,
            suite: suite.name,
            errorMessage: test.errorMessage,
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
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'in_progress':
        return <ClockIcon className="w-5 h-5 text-blue-500" />;
      default:
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'in_progress':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-red-50 border-red-200';
    }
  };
  const failedTests = Object.values(progressData);
  const totalTests = failedTests.length;
  const completedTests = failedTests.filter(test => test.status === 'completed').length;
  const inProgressTests = failedTests.filter(test => test.status === 'in_progress').length;
  const handleShowStackTrace = (test: FailureProgressItem) => {
    // Find the original test data to get all details
    const suite = testData.suites.find(s => s.name === test.suite);
    const testDetails = suite?.testcases.find(t => t.name === test.name);
    if (!testDetails) return;
    // Create a complete test object with all necessary fields
    const modalTest = {
      ...testDetails,
      suite: test.suite,
      status: 'failed',
      errorMessage: testDetails.errorMessage || test.errorMessage,
      failureDetails: testDetails.failureDetails || {
        message: testDetails.errorMessage || test.errorMessage,
        type: 'Error',
        stackTrace: testDetails.errorMessage || test.errorMessage
      }
    };
    setShowStackTrace(modalTest);
  };
  return <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Failure Resolution Progress
        </h2>
        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Failed Tests</span>
              <span className="text-xl font-bold text-gray-800">
                {totalTests}
              </span>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-green-600">Completed</span>
              <span className="text-xl font-bold text-green-700">
                {completedTests}
              </span>
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-blue-600">In Progress</span>
              <span className="text-xl font-bold text-blue-700">
                {inProgressTests}
              </span>
            </div>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div className="bg-green-600 h-2 rounded-full transition-all duration-300" style={{
          width: `${completedTests / totalTests * 100}%`
        }} />
        </div>
        {/* Failed Tests List */}
        <div className="space-y-4">
          {failedTests.map(test => <div key={test.id} className={`border rounded-lg overflow-hidden ${getStatusColor(test.status)}`}>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(test.status)}
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">
                        {test.name}
                      </h4>
                      <p className="text-sm text-gray-500">
                        Suite: {test.suite}
                      </p>
                    </div>
                  </div>
                  {selectedTest !== test.id ? <button onClick={() => setSelectedTest(test.id)} className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                      Update Status
                    </button> : <div className="flex space-x-2">
                      <button onClick={() => updateTestStatus(test.id, 'pending')} className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200">
                        Pending
                      </button>
                      <button onClick={() => updateTestStatus(test.id, 'in_progress')} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200">
                        In Progress
                      </button>
                      <button onClick={() => updateTestStatus(test.id, 'completed')} className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200">
                        Complete
                      </button>
                    </div>}
                </div>
                {/* Add Stack Trace button */}
                <div className="mt-2 flex justify-end">
                  <button onClick={() => handleShowStackTrace(test)} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
                    View Stack Trace
                  </button>
                </div>
                {selectedTest === test.id && <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Assignee
                      </label>
                      <input type="text" value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="Who is working on this?" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add any notes about the fix..." className="w-full px-3 py-2 border border-gray-300 rounded-md" rows={3} />
                    </div>
                  </div>}
                {!selectedTest && test.notes && <div className="mt-2 text-sm text-gray-600">
                    <p>
                      <strong>Notes:</strong> {test.notes}
                    </p>
                    {test.assignee && <p>
                        <strong>Assignee:</strong> {test.assignee}
                      </p>}
                    <p>
                      <strong>Last Updated:</strong>{' '}
                      {new Date(test.updatedAt).toLocaleString()}
                    </p>
                  </div>}
              </div>
            </div>)}
        </div>
      </div>
      {/* Stack Trace Modal */}
      {showStackTrace && <TestDetailsModal test={showStackTrace} onClose={() => setShowStackTrace(null)} />}
    </div>;
};