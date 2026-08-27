import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishPage } from '../components/Publish/PublishPage';
import { parseJUnitXML } from '../utils/xmlParser';
import type { TestData } from '../types';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  SendIcon: () => <div data-testid="send-icon" />,
  FileIcon: () => <div data-testid="file-icon" />,
  UploadIcon: () => <div data-testid="upload-icon" />,
  LoaderIcon: () => <div data-testid="loader-icon" />,
  CheckCircleIcon: () => <div data-testid="check-circle-icon" />,
  XCircleIcon: () => <div data-testid="x-circle-icon" />,
  PlusIcon: () => <div data-testid="plus-icon" />,
  XIcon: () => <div data-testid="x-icon" />,
}));

/**
 * Create a File object with a working text() method for jsdom.
 */
function createMockFile(content: string, name: string, type = 'text/xml'): File {
  const file = new File([content], name, { type });
  // jsdom may not implement File.text(), so polyfill it
  if (typeof file.text !== 'function') {
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(content),
    });
  }
  return file;
}

const sampleTestData: TestData = {
  summary: { total: 10, passed: 8, failed: 2, skipped: 0, time: 12.3 },
  suites: [
    {
      name: 'Suite A',
      tests: 10,
      failures: 2,
      errors: 0,
      skipped: 0,
      time: 12.3,
      timestamp: '2024-01-01T00:00:00Z',
      testcases: [],
    },
  ],
};

const VALID_JUNIT_XML =
  '<testsuites><testsuite name="s1" tests="1" failures="0" errors="0" skipped="0" time="1.0" timestamp="2024-01-01T00:00:00.000Z">' +
  '<testcase name="t1" time="1.0"/></testsuite></testsuites>';

describe('PublishPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Tests must not depend on whatever VITE_EXECUTED_BY happens to be set
    // to in the real .env on this machine — force "unset" by default, and
    // let the one test that wants it set override this explicitly.
    vi.stubEnv('VITE_EXECUTED_BY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should render the publish form', () => {
    render(<PublishPage testData={null} />);

    expect(screen.getByText('Publish Test Results')).toBeInTheDocument();
    expect(screen.getByText('Send a summary of your test results directly to a Slack channel.')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('Test Results XML')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
  });

  it('should render metadata key/value inputs', () => {
    render(<PublishPage testData={null} />);

    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    // Two metadata entries
    const keyInputs = screen.getAllByText('Key');
    const valueInputs = screen.getAllByText('Value');
    expect(keyInputs).toHaveLength(2);
    expect(valueInputs).toHaveLength(2);
  });

  it('should pre-fill the first metadata row\'s key with "Failed Tests"', () => {
    render(<PublishPage testData={null} />);

    const metaKey0 = screen.getByPlaceholderText('e.g., Failed Tests');
    expect(metaKey0).toHaveValue('Failed Tests');
    // The value is deliberately left blank — the parsed XML's failure count
    // includes flaky-test retries, so it can't be trusted to auto-fill this.
    expect(screen.getByPlaceholderText('e.g., 54')).toHaveValue('');
  });

  it('should leave the "Executed By" row blank when VITE_EXECUTED_BY is not set', () => {
    render(<PublishPage testData={null} />);

    expect(screen.getByPlaceholderText('e.g., Executed By')).toHaveValue('');
    expect(screen.getByPlaceholderText('e.g., Brian')).toHaveValue('');
  });

  it('should pre-fill "Executed By" from VITE_EXECUTED_BY when it is set', () => {
    vi.stubEnv('VITE_EXECUTED_BY', 'Brian');

    render(<PublishPage testData={null} />);

    expect(screen.getByPlaceholderText('e.g., Executed By')).toHaveValue('Executed By');
    expect(screen.getByPlaceholderText('e.g., Brian')).toHaveValue('Brian');
  });

  it('should allow typing in title input', async () => {
    const user = userEvent.setup();
    render(<PublishPage testData={null} />);

    const titleInput = screen.getByLabelText('Title');
    await user.type(titleInput, 'My Test Title');
    expect(titleInput).toHaveValue('My Test Title');
  });

  it('should allow typing in metadata inputs', async () => {
    const user = userEvent.setup();
    render(<PublishPage testData={null} />);

    const metaKey0 = screen.getByPlaceholderText('e.g., Failed Tests');
    const metaVal0 = screen.getByPlaceholderText('e.g., 54');
    const metaKey1 = screen.getByPlaceholderText('e.g., Executed By');
    const metaVal1 = screen.getByPlaceholderText('e.g., Brian');

    // metaKey0 starts pre-filled with "Failed Tests" — clear it first so
    // typing replaces rather than appends to the pre-filled value.
    await user.clear(metaKey0);
    await user.type(metaKey0, 'Renamed Key');
    await user.type(metaVal0, '10');
    await user.type(metaKey1, 'Executed By');
    await user.type(metaVal1, 'Alice');

    expect(metaKey0).toHaveValue('Renamed Key');
    expect(metaVal0).toHaveValue('10');
    expect(metaKey1).toHaveValue('Executed By');
    expect(metaVal1).toHaveValue('Alice');
  });

  it('should add a metadata row when "Add metadata" is clicked', () => {
    render(<PublishPage testData={null} />);

    fireEvent.click(screen.getByText('Add metadata'));

    expect(screen.getAllByText('Key')).toHaveLength(3);
    expect(screen.getAllByText('Value')).toHaveLength(3);
  });

  it('should remove a metadata row when its remove button is clicked', () => {
    render(<PublishPage testData={null} />);

    const removeButtons = screen.getAllByLabelText('Remove metadata row');
    fireEvent.click(removeButtons[0]);

    expect(screen.getAllByText('Key')).toHaveLength(1);
    expect(screen.getAllByText('Value')).toHaveLength(1);
  });

  it('should cap metadata entries at 6 and disable the Add metadata button', () => {
    render(<PublishPage testData={null} />);

    const addButton = screen.getByText('Add metadata').closest('button')!;
    // Starts with 2 rows; click up to the cap of 6.
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    expect(screen.getAllByText('Key')).toHaveLength(6);
    expect(addButton).toBeDisabled();

    // Further clicks (e.g. via keyboard activation despite the disabled
    // state) must not add a 7th row.
    fireEvent.click(addButton);
    expect(screen.getAllByText('Key')).toHaveLength(6);
  });

  it('should not show loaded XML option when testData is null', () => {
    render(<PublishPage testData={null} />);

    expect(screen.queryByText('Use loaded XML file from Dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('Choose a new XML file')).toBeInTheDocument();
  });

  it('should show loaded XML option when testData is provided', () => {
    render(<PublishPage testData={sampleTestData} />);

    expect(screen.getByText('Use loaded XML file from Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Choose a new XML file')).toBeInTheDocument();
  });

  it('should default to loaded XML source when testData is provided', () => {
    render(<PublishPage testData={sampleTestData} />);

    const loadedRadio = screen.getByDisplayValue('loaded');
    const fileRadio = screen.getByDisplayValue('file');

    expect(loadedRadio).toBeChecked();
    expect(fileRadio).not.toBeChecked();
  });

  it('should default to file XML source when testData is null', () => {
    render(<PublishPage testData={null} />);

    const fileRadio = screen.getByDisplayValue('file');
    expect(fileRadio).toBeChecked();
  });

  it('should switch XML source when radio buttons are clicked', async () => {
    render(<PublishPage testData={sampleTestData} />);

    const fileRadio = screen.getByDisplayValue('file');
    fireEvent.click(fileRadio);
    expect(fileRadio).toBeChecked();

    const loadedRadio = screen.getByDisplayValue('loaded');
    fireEvent.click(loadedRadio);
    expect(loadedRadio).toBeChecked();
  });

  it('should show file chooser button when file source is selected', () => {
    render(<PublishPage testData={null} />);

    expect(screen.getByText('Select XML File')).toBeInTheDocument();
  });

  it('should hide file chooser when loaded source is selected', () => {
    render(<PublishPage testData={sampleTestData} />);

    // loaded is default when testData provided
    expect(screen.queryByText('Select XML File')).not.toBeInTheDocument();
  });

  it('should show error when publishing without title', async () => {
    render(<PublishPage testData={sampleTestData} />);

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Title is a required field.')).toBeInTheDocument();
    });
  });

  it('should show error when publishing without XML', async () => {
    const user = userEvent.setup();
    render(<PublishPage testData={null} />);

    await user.type(screen.getByLabelText('Title'), 'My Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Please provide an XML file for publishing.')).toBeInTheDocument();
    });
  });

  it('should show a parse error when the selected file is not valid JUnit XML', async () => {
    const user = userEvent.setup();
    render(<PublishPage testData={null} />);

    await user.type(screen.getByLabelText('Title'), 'My Title');

    const badFile = createMockFile('<foo>not junit</foo>', 'bad.xml');
    const fileInput = screen.getByTestId('xml-file-input');
    await user.upload(fileInput, badFile);

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Could not parse the selected file. Make sure it is valid JUnit XML.')).toBeInTheDocument();
    });
  });

  it('should publish successfully with loaded test data', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
    global.fetch = mockFetch;

    render(<PublishPage testData={sampleTestData} />);

    await user.type(screen.getByLabelText('Title'), 'My Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Test results published to Slack!')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('"title":"My Title"'),
    });
  });

  it('should publish with metadata filtered to only complete key+value pairs', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
    global.fetch = mockFetch;

    render(<PublishPage testData={sampleTestData} />);

    await user.type(screen.getByLabelText('Title'), 'Title');
    // Only fill in the value for the pre-filled "Failed Tests" key.
    await user.type(screen.getByPlaceholderText('e.g., 54'), 'MyValue');
    // Leave the second metadata entry (Executed By) empty entirely

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.metadata).toHaveLength(1);
    expect(callBody.metadata[0]).toEqual({ key: 'Failed Tests', value: 'MyValue' });
  });

  it('should not send a metadata row that has a pre-filled key but no value', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
    global.fetch = mockFetch;

    render(<PublishPage testData={sampleTestData} />);

    await user.type(screen.getByLabelText('Title'), 'Title');
    // Leave the pre-filled "Failed Tests" key's value untouched (blank).

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.metadata).toHaveLength(0);
  });

  it('should show error status on publish failure', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'Slack rejected the payload' }),
    });
    global.fetch = mockFetch;

    render(<PublishPage testData={sampleTestData} />);

    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Slack rejected the payload')).toBeInTheDocument();
    });
  });

  it('should show error when fetch throws', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = mockFetch;

    render(<PublishPage testData={sampleTestData} />);

    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should show non-Error message when fetch throws non-Error', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockRejectedValue('string error');
    global.fetch = mockFetch;

    render(<PublishPage testData={sampleTestData} />);

    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Failed to publish. Is the dev server running?')).toBeInTheDocument();
    });
  });

  it('should publish with file chooser XML', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
    global.fetch = mockFetch;

    render(<PublishPage testData={null} />);

    await user.type(screen.getByLabelText('Title'), 'Title');

    // Create and upload a file
    const xmlFile = createMockFile(VALID_JUNIT_XML, 'test.xml');
    const fileInput = screen.getByTestId('xml-file-input');
    await user.upload(fileInput, xmlFile);

    // File name should be displayed
    expect(screen.getByText('test.xml')).toBeInTheDocument();
    expect(screen.getByText('Change File')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.testData).toEqual(parseJUnitXML(VALID_JUNIT_XML));
  });

  it('should ignore a file input change when no file was selected', async () => {
    render(<PublishPage testData={null} />);

    const fileInput = screen.getByTestId('xml-file-input');
    fireEvent.change(fileInput, { target: { files: [] } });

    // No file name should be displayed since the selection was cancelled
    expect(screen.queryByText('Change File')).not.toBeInTheDocument();
  });

  it('should use error message from API result when no specific error', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false }),
    });
    global.fetch = mockFetch;

    render(<PublishPage testData={sampleTestData} />);

    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Publishing failed.')).toBeInTheDocument();
    });
  });

  it('should render success status with correct styling', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
    global.fetch = mockFetch;

    render(<PublishPage testData={sampleTestData} />);

    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      const statusDiv = screen.getByTestId('publish-status');
      expect(statusDiv).toHaveClass('bg-success/5');
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    });
  });

  it('should render error status with correct styling', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'fail' }),
    });
    global.fetch = mockFetch;

    render(<PublishPage testData={sampleTestData} />);

    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      const statusDiv = screen.getByTestId('publish-status');
      expect(statusDiv).toHaveClass('bg-destructive/5');
      expect(screen.getByTestId('x-circle-icon')).toBeInTheDocument();
    });
  });

  it('should set xmlSource to file when a file is selected even if loaded is default', async () => {
    const user = userEvent.setup();
    render(<PublishPage testData={sampleTestData} />);

    // Initially loaded
    expect(screen.getByDisplayValue('loaded')).toBeChecked();

    // Switch to file mode
    fireEvent.click(screen.getByDisplayValue('file'));

    // Upload a file
    const xmlFile = createMockFile(VALID_JUNIT_XML, 'chosen.xml');
    const fileInput = screen.getByTestId('xml-file-input');
    await user.upload(fileInput, xmlFile);

    expect(screen.getByDisplayValue('file')).toBeChecked();
    expect(screen.getByText('chosen.xml')).toBeInTheDocument();
  });

  it('should include testData from loaded source in publish request', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
    global.fetch = mockFetch;

    render(<PublishPage testData={sampleTestData} />);

    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.testData).toEqual(sampleTestData);
  });

  it('should trim whitespace from title before sending', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
    global.fetch = mockFetch;

    render(<PublishPage testData={sampleTestData} />);

    await user.type(screen.getByLabelText('Title'), '  My Title  ');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.title).toBe('My Title');
  });
});
