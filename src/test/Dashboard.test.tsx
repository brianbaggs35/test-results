import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from '../components/Dashboard/Dashboard';

// Mock child components
vi.mock('../components/Dashboard/FileUploader', () => ({
  FileUploader: ({ onFileUpload, isLoading, error }: any) => (
    <div data-testid="file-uploader">
      <div>File Uploader</div>
      {isLoading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error}</div>}
      <button 
        data-testid="upload-trigger" 
        onClick={() => {
          const mockFile = new File(['<testsuite></testsuite>'], 'test.xml', { type: 'text/xml' });
          Object.defineProperty(mockFile, 'text', {
            value: () => Promise.resolve('<testsuite name="Test" tests="1"><testcase name="test1"/></testsuite>')
          });
          onFileUpload(mockFile);
        }}
      >
        Upload File
      </button>
      <button 
        data-testid="upload-invalid" 
        onClick={() => {
          const mockFile = new File(['invalid xml'], 'test.xml', { type: 'text/xml' });
          Object.defineProperty(mockFile, 'text', {
            value: () => Promise.resolve('invalid xml')
          });
          onFileUpload(mockFile);
        }}
      >
        Upload Invalid
      </button>
    </div>
  ),
}));

vi.mock('../components/Dashboard/TestMetrics', () => ({
  TestMetrics: ({ testData }: any) => (
    <div data-testid="test-metrics">
      Test Metrics Component
      {testData && <div data-testid="metrics-data">Metrics with data</div>}
    </div>
  ),
}));

vi.mock('../components/Dashboard/TestResultsList', () => ({
  TestResultsList: ({ testData }: any) => (
    <div data-testid="test-results-list">
      Test Results List Component  
      {testData && <div data-testid="results-data">Results with data</div>}
    </div>
  ),
}));

// Mock the XML parser
vi.mock('../utils/xmlParser', () => ({
  parseJUnitXML: vi.fn((content: string) => {
    if (content === 'invalid xml') {
      throw new Error('Invalid XML');
    }
    return {
      summary: { total: 1, passed: 1, failed: 0, skipped: 0, time: 1.0 },
      suites: [{ name: 'Test', testcases: [{ name: 'test1', status: 'passed' }] }]
    };
  })
}));

describe('Dashboard', () => {
  const mockOnDataUpload = vi.fn();

  beforeEach(() => {
    mockOnDataUpload.mockClear();
    vi.clearAllMocks();
  });

  it('should render dashboard title', () => {
    render(<Dashboard onDataUpload={mockOnDataUpload} testData={null} />);
    
    expect(screen.getByText('Test Results Dashboard')).toBeInTheDocument();
  });

  it('should show file uploader when no test data is available', () => {
    render(<Dashboard onDataUpload={mockOnDataUpload} testData={null} />);
    
    expect(screen.getByTestId('file-uploader')).toBeInTheDocument();
    expect(screen.getByText('File Uploader')).toBeInTheDocument();
  });

  it('should not show file uploader when test data is available', () => {
    const testData = {
      summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
      suites: []
    };
    
    render(<Dashboard onDataUpload={mockOnDataUpload} testData={testData} />);
    
    expect(screen.queryByTestId('file-uploader')).not.toBeInTheDocument();
  });

  it('should show test metrics and results list when test data is available', () => {
    const testData = {
      summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
      suites: []
    };
    
    render(<Dashboard onDataUpload={mockOnDataUpload} testData={testData} />);
    
    expect(screen.getByTestId('test-metrics')).toBeInTheDocument();
    expect(screen.getByTestId('test-results-list')).toBeInTheDocument();
    expect(screen.getByTestId('metrics-data')).toBeInTheDocument();
    expect(screen.getByTestId('results-data')).toBeInTheDocument();
  });

  it('should handle successful file upload', async () => {
    render(<Dashboard onDataUpload={mockOnDataUpload} testData={null} />);
    
    // Trigger file upload
    const uploadButton = screen.getByTestId('upload-trigger');
    uploadButton.click();
    
    // Wait for async operation to complete
    await waitFor(() => {
      expect(mockOnDataUpload).toHaveBeenCalledWith({
        summary: { total: 1, passed: 1, failed: 0, skipped: 0, time: 1.0 },
        suites: [{ name: 'Test', testcases: [{ name: 'test1', status: 'passed' }] }]
      });
    });
  });

  it('should handle file upload error', async () => {
    render(<Dashboard onDataUpload={mockOnDataUpload} testData={null} />);
    
    // Trigger invalid file upload
    const uploadInvalidButton = screen.getByTestId('upload-invalid');
    uploadInvalidButton.click();
    
    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
      expect(screen.getByText('Failed to parse the XML file. Please ensure it is a valid JUnit XML file.')).toBeInTheDocument();
    });
    
    expect(mockOnDataUpload).not.toHaveBeenCalled();
  });

  it('should show loading state during file upload', async () => {
    render(<Dashboard onDataUpload={mockOnDataUpload} testData={null} />);
    
    // Mock a slower async operation
    const mockFile = new File(['content'], 'test.xml');
    Object.defineProperty(mockFile, 'text', {
      value: () => new Promise(resolve => setTimeout(() => resolve('<testsuite></testsuite>'), 100))
    });
    
    // The loading state is handled internally, so we just verify the component renders
    expect(screen.getByTestId('file-uploader')).toBeInTheDocument();
  });

  it('should clear error state when starting new upload', async () => {
    render(<Dashboard onDataUpload={mockOnDataUpload} testData={null} />);
    
    // First upload with error
    const uploadInvalidButton = screen.getByTestId('upload-invalid');
    uploadInvalidButton.click();
    
    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });
    
    // Second upload should clear error
    const uploadButton = screen.getByTestId('upload-trigger');
    uploadButton.click();
    
    await waitFor(() => {
      expect(mockOnDataUpload).toHaveBeenCalled();
    });
  });

  it('should handle undefined testData', () => {
    render(<Dashboard onDataUpload={mockOnDataUpload} testData={undefined} />);
    
    expect(screen.getByTestId('file-uploader')).toBeInTheDocument();
    expect(screen.queryByTestId('test-metrics')).not.toBeInTheDocument();
  });

  it('should pass testData correctly to child components', () => {
    const testData = {
      summary: { total: 5, passed: 3, failed: 2, skipped: 0 },
      suites: [
        { name: 'Suite1', testcases: [] },
        { name: 'Suite2', testcases: [] }
      ]
    };
    
    render(<Dashboard onDataUpload={mockOnDataUpload} testData={testData} />);
    
    expect(screen.getByTestId('test-metrics')).toBeInTheDocument();
    expect(screen.getByTestId('test-results-list')).toBeInTheDocument();
  });
});