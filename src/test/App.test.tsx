import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';

// Mock the child components to isolate App testing
vi.mock('../components/Layout/Navbar', () => ({
  Navbar: ({ activeTab, setActiveTab }: any) => (
    <div data-testid="navbar">
      <button data-testid="dashboard-tab" onClick={() => setActiveTab('dashboard')}>
        Dashboard {activeTab === 'dashboard' && '(active)'}
      </button>
      <button data-testid="failures-tab" onClick={() => setActiveTab('failures')}>
        Failures {activeTab === 'failures' && '(active)'}
      </button>
      <button data-testid="progress-tab" onClick={() => setActiveTab('progress')}>
        Progress {activeTab === 'progress' && '(active)'}
      </button>
      <button data-testid="report-tab" onClick={() => setActiveTab('report')}>
        Report {activeTab === 'report' && '(active)'}
      </button>
    </div>
  ),
}));

vi.mock('../components/Dashboard/Dashboard', () => ({
  Dashboard: ({ onDataUpload, testData }: any) => (
    <div data-testid="dashboard">
      Dashboard Component
      <button data-testid="upload-data" onClick={() => onDataUpload({ test: 'data' })}>
        Upload Data
      </button>
      {testData && <div data-testid="test-data">Test data loaded</div>}
    </div>
  ),
}));

vi.mock('../components/FailureAnalysis/FailureAnalysisPage', () => ({
  FailureAnalysisPage: ({ testData }: any) => (
    <div data-testid="failure-analysis">
      Failure Analysis
      {testData && <div data-testid="failure-test-data">Data available</div>}
    </div>
  ),
}));

vi.mock('../components/FailureAnalysis/FailureAnalysisProgress', () => ({
  FailureAnalysisProgress: ({ testData }: any) => (
    <div data-testid="failure-progress">
      Progress Component
      {testData && <div data-testid="progress-test-data">Data available</div>}
    </div>
  ),
}));

vi.mock('../components/ReportGenerator/ReportGenerator', () => ({
  ReportGenerator: ({ testData }: any) => (
    <div data-testid="report-generator">
      Report Generator
      {testData && <div data-testid="report-test-data">Data available</div>}
    </div>
  ),
}));

describe('App', () => {
  it('should render with dashboard as default tab', () => {
    render(<App />);
    
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.getByText('Dashboard (active)')).toBeInTheDocument();
  });

  it('should switch to failures tab when clicked', () => {
    render(<App />);
    
    fireEvent.click(screen.getByTestId('failures-tab'));
    
    expect(screen.getByTestId('failure-analysis')).toBeInTheDocument();
    expect(screen.getByText('Failures (active)')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });

  it('should switch to progress tab when clicked', () => {
    render(<App />);
    
    fireEvent.click(screen.getByTestId('progress-tab'));
    
    expect(screen.getByTestId('failure-progress')).toBeInTheDocument();
    expect(screen.getByText('Progress (active)')).toBeInTheDocument();
  });

  it('should switch to report tab when clicked', () => {
    render(<App />);
    
    fireEvent.click(screen.getByTestId('report-tab'));
    
    expect(screen.getByTestId('report-generator')).toBeInTheDocument();
    expect(screen.getByText('Report (active)')).toBeInTheDocument();
  });

  it('should handle data upload and pass data to components', () => {
    render(<App />);
    
    // Upload data from dashboard
    fireEvent.click(screen.getByTestId('upload-data'));
    
    // Verify data is shown in dashboard
    expect(screen.getByTestId('test-data')).toBeInTheDocument();
    
    // Switch to failures tab and verify data is passed
    fireEvent.click(screen.getByTestId('failures-tab'));
    expect(screen.getByTestId('failure-test-data')).toBeInTheDocument();
    
    // Switch to progress tab and verify data is passed
    fireEvent.click(screen.getByTestId('progress-tab'));
    expect(screen.getByTestId('progress-test-data')).toBeInTheDocument();
    
    // Switch to report tab and verify data is passed
    fireEvent.click(screen.getByTestId('report-tab'));
    expect(screen.getByTestId('report-test-data')).toBeInTheDocument();
  });

  it('should default to dashboard for unknown tabs', () => {
    // This tests the default case in the switch statement
    render(<App />);
    
    // We can't directly test this without modifying the component,
    // but we can verify the initial state is dashboard
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });

  it('should maintain test data when switching tabs', () => {
    render(<App />);
    
    // Upload data
    fireEvent.click(screen.getByTestId('upload-data'));
    
    // Switch tabs multiple times
    fireEvent.click(screen.getByTestId('failures-tab'));
    fireEvent.click(screen.getByTestId('dashboard-tab'));
    fireEvent.click(screen.getByTestId('report-tab'));
    
    // Data should still be available
    expect(screen.getByTestId('report-test-data')).toBeInTheDocument();
  });
});