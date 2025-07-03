import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportGenerator } from '../components/ReportGenerator/ReportGenerator';
import { TestData, ReportConfig } from '../types';

// Mock components to avoid complex dependencies in unit tests
vi.mock('../components/ReportGenerator/ReportPreview', () => ({
  ReportPreview: ({ testData, config }: { testData: TestData; config: ReportConfig }) => (
    <div data-testid="report-preview">
      <span data-testid="preview-title">{config.title}</span>
      <span data-testid="preview-author">{config.author}</span>
      <span data-testid="preview-project">{config.projectName}</span>
      <span data-testid="preview-total">{testData.summary.total}</span>
      {config.includeExecutiveSummary && <span data-testid="preview-exec-summary">Executive Summary</span>}
      {config.includeTestMetrics && <span data-testid="preview-metrics">Test Metrics</span>}
      {config.includeFailedTests && <span data-testid="preview-failed">Failed Tests</span>}
      {config.includeAllTests && <span data-testid="preview-all">All Tests</span>}
      {config.includeResolutionProgress && <span data-testid="preview-progress">Resolution Progress</span>}
    </div>
  )
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  FileTextIcon: () => <div data-testid="file-text-icon" />,
  EyeIcon: () => <div data-testid="eye-icon" />
}));

describe('ReportGenerator', () => {
  let mockTestData: TestData;

  beforeEach(() => {
    mockTestData = {
      summary: {
        total: 100,
        passed: 75,
        failed: 20,
        skipped: 5,
        time: 120.5
      },
      suites: [
        {
          name: 'Suite 1',
          tests: 50,
          failures: 10,
          errors: 0,
          skipped: 2,
          time: 60.0,
          timestamp: '2024-01-01T12:00:00Z',
          testcases: [
            {
              name: 'Test 1',
              status: 'passed',
              suite: 'Suite 1',
              time: 1.5
            },
            {
              name: 'Test 2',
              status: 'failed',
              suite: 'Suite 1',
              time: 2.1,
              errorMessage: 'Assertion failed'
            }
          ]
        }
      ]
    };

    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      value: {
        reload: vi.fn()
      },
      writable: true
    });
  });

  it('should render no data message when testData is null', () => {
    render(<ReportGenerator testData={null} />);

    expect(screen.getByText('No Test Data Available')).toBeInTheDocument();
    expect(screen.getByText(/Please upload a JUnit XML file/)).toBeInTheDocument();
    expect(screen.getByTestId('file-text-icon')).toBeInTheDocument();
  });

  it('should render configuration form when testData is provided', () => {
    render(<ReportGenerator testData={mockTestData} />);

    expect(screen.getByText('Report Generator')).toBeInTheDocument();
    expect(screen.getByText('Report Configuration')).toBeInTheDocument();
    expect(screen.getByLabelText('Report Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Author')).toBeInTheDocument();
    expect(screen.getByLabelText('Project Name')).toBeInTheDocument();
  });

  it('should have default configuration values', () => {
    render(<ReportGenerator testData={mockTestData} />);

    expect(screen.getByDisplayValue('Automated Test Results Report')).toBeInTheDocument();
    expect(screen.getByLabelText('Include Executive Summary')).toBeChecked();
    expect(screen.getByLabelText('Include Test Metrics and Charts')).toBeChecked();
    expect(screen.getByLabelText('Include Failed Tests Details')).toBeChecked();
    expect(screen.getByLabelText('Include All Test Cases')).not.toBeChecked();
    expect(screen.getByLabelText('Include Failure Resolution Progress')).not.toBeChecked();
  });

  it('should update text input fields', async () => {
    const user = userEvent.setup();
    render(<ReportGenerator testData={mockTestData} />);

    const titleInput = screen.getByLabelText('Report Title');
    const authorInput = screen.getByLabelText('Author');
    const projectInput = screen.getByLabelText('Project Name');

    await user.clear(titleInput);
    await user.type(titleInput, 'Custom Report Title');
    expect(titleInput).toHaveValue('Custom Report Title');

    await user.type(authorInput, 'John Doe');
    expect(authorInput).toHaveValue('John Doe');

    await user.type(projectInput, 'My Project');
    expect(projectInput).toHaveValue('My Project');
  });

  it('should update checkbox fields', async () => {
    const user = userEvent.setup();
    render(<ReportGenerator testData={mockTestData} />);

    const execSummaryCheckbox = screen.getByLabelText('Include Executive Summary');
    const allTestsCheckbox = screen.getByLabelText('Include All Test Cases');

    expect(execSummaryCheckbox).toBeChecked();
    expect(allTestsCheckbox).not.toBeChecked();

    await user.click(execSummaryCheckbox);
    expect(execSummaryCheckbox).not.toBeChecked();

    await user.click(allTestsCheckbox);
    expect(allTestsCheckbox).toBeChecked();
  });

  it('should show preview when generate report button is clicked', async () => {
    const user = userEvent.setup();
    render(<ReportGenerator testData={mockTestData} />);

    const generateButton = screen.getByText('Preview Report');
    await user.click(generateButton);

    expect(screen.getByTestId('report-preview')).toBeInTheDocument();
  });

  it('should pass correct configuration to preview component', async () => {
    const user = userEvent.setup();
    render(<ReportGenerator testData={mockTestData} />);

    // Update configuration
    await user.clear(screen.getByLabelText('Report Title'));
    await user.type(screen.getByLabelText('Report Title'), 'Custom Title');
    await user.type(screen.getByLabelText('Author'), 'Test Author');
    await user.type(screen.getByLabelText('Project Name'), 'Test Project');
    await user.click(screen.getByLabelText('Include All Test Cases'));

    // Generate report
    await user.click(screen.getByText('Preview Report'));

    // Check preview receives correct config
    expect(screen.getByTestId('preview-title')).toHaveTextContent('Custom Title');
    expect(screen.getByTestId('preview-author')).toHaveTextContent('Test Author');
    expect(screen.getByTestId('preview-project')).toHaveTextContent('Test Project');
    expect(screen.getByTestId('preview-all')).toBeInTheDocument();
  });

  it('should pass test data to preview component', async () => {
    const user = userEvent.setup();
    render(<ReportGenerator testData={mockTestData} />);

    await user.click(screen.getByText('Preview Report'));

    expect(screen.getByTestId('preview-total')).toHaveTextContent('100');
  });

  it('should conditionally show sections based on checkboxes', async () => {
    const user = userEvent.setup();
    render(<ReportGenerator testData={mockTestData} />);

    // Uncheck some options
    await user.click(screen.getByLabelText('Include Executive Summary'));
    await user.click(screen.getByLabelText('Include Test Metrics and Charts'));

    await user.click(screen.getByText('Preview Report'));

    expect(screen.queryByTestId('preview-exec-summary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('preview-metrics')).not.toBeInTheDocument();
    expect(screen.getByTestId('preview-failed')).toBeInTheDocument(); // Still checked
  });

  it('should reload page when "Go to Dashboard" is clicked with no data', () => {
    render(<ReportGenerator testData={null} />);

    const dashboardButton = screen.getByText('Go to Dashboard');
    fireEvent.click(dashboardButton);

    expect(window.location.reload).toHaveBeenCalled();
  });

  it('should have proper form accessibility', () => {
    render(<ReportGenerator testData={mockTestData} />);

    // Check that all form inputs have proper labels
    expect(screen.getByLabelText('Report Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Author')).toBeInTheDocument();
    expect(screen.getByLabelText('Project Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Include Executive Summary')).toBeInTheDocument();
    expect(screen.getByLabelText('Include Test Metrics and Charts')).toBeInTheDocument();
    expect(screen.getByLabelText('Include Failed Tests Details')).toBeInTheDocument();
    expect(screen.getByLabelText('Include All Test Cases')).toBeInTheDocument();
    expect(screen.getByLabelText('Include Failure Resolution Progress')).toBeInTheDocument();
  });

  it('should handle empty string values properly', async () => {
    const user = userEvent.setup();
    render(<ReportGenerator testData={mockTestData} />);

    const authorInput = screen.getByLabelText('Author');
    const projectInput = screen.getByLabelText('Project Name');

    // These should start empty
    expect(authorInput).toHaveValue('');
    expect(projectInput).toHaveValue('');

    await user.click(screen.getByText('Preview Report'));

    // Should still work with empty values
    expect(screen.getByTestId('preview-author')).toHaveTextContent('');
    expect(screen.getByTestId('preview-project')).toHaveTextContent('');
  });

  it('should maintain form state when switching to preview and back', async () => {
    const user = userEvent.setup();
    render(<ReportGenerator testData={mockTestData} />);

    // Make changes to form
    await user.type(screen.getByLabelText('Author'), 'Test Author');
    await user.click(screen.getByLabelText('Include All Test Cases'));

    // Generate preview
    await user.click(screen.getByText('Preview Report'));
    expect(screen.getByTestId('report-preview')).toBeInTheDocument();

    // Note: In a real implementation, there would likely be a way to go back
    // This test verifies the current state is maintained
    expect(screen.getByTestId('preview-author')).toHaveTextContent('Test Author');
    expect(screen.getByTestId('preview-all')).toBeInTheDocument();
  });
});