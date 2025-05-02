import React from 'react';
import { BarChartIcon, FileTextIcon, AlertTriangleIcon, ListChecksIcon } from 'lucide-react';
export const Navbar = ({
  activeTab,
  setActiveTab
}) => {
  return <nav className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">
              Test Results Platform
            </h1>
          </div>
          <div className="flex space-x-4">
            <button className={`flex items-center px-4 py-2 rounded-md ${activeTab === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`} onClick={() => setActiveTab('dashboard')}>
              <BarChartIcon className="w-5 h-5 mr-2" />
              Dashboard
            </button>
            <button className={`flex items-center px-4 py-2 rounded-md ${activeTab === 'failures' ? 'bg-red-100 text-red-700' : 'text-gray-600 hover:bg-gray-100'}`} onClick={() => setActiveTab('failures')}>
              <AlertTriangleIcon className="w-5 h-5 mr-2" />
              Failures
            </button>
            <button className={`flex items-center px-4 py-2 rounded-md ${activeTab === 'progress' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`} onClick={() => setActiveTab('progress')}>
              <ListChecksIcon className="w-5 h-5 mr-2" />
              Progress
            </button>
            <button className={`flex items-center px-4 py-2 rounded-md ${activeTab === 'report' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`} onClick={() => setActiveTab('report')}>
              <FileTextIcon className="w-5 h-5 mr-2" />
              Report
            </button>
          </div>
        </div>
      </div>
    </nav>;
};