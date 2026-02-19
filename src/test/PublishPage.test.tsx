import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishPage } from '../components/Publish/PublishPage';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  SendIcon: () => <div data-testid="send-icon" />,
  FileIcon: () => <div data-testid="file-icon" />,
  UploadIcon: () => <div data-testid="upload-icon" />,
  LoaderIcon: () => <div data-testid="loader-icon" />,
  CheckCircleIcon: () => <div data-testid="check-circle-icon" />,
  XCircleIcon: () => <div data-testid="x-circle-icon" />,
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

describe('PublishPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should render the publish form', () => {
    render(<PublishPage xmlContent={null} />);

    expect(screen.getByText('Publish Test Results')).toBeInTheDocument();
    expect(screen.getByText('Configure and publish your test results using TestBeats.')).toBeInTheDocument();
    expect(screen.getByLabelText('Run Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('Test Results XML')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
  });

  it('should render metadata key/value inputs', () => {
    render(<PublishPage xmlContent={null} />);

    expect(screen.getByLabelText('Run Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    // Two metadata entries
    const keyInputs = screen.getAllByText('Key');
    const valueInputs = screen.getAllByText('Value');
    expect(keyInputs).toHaveLength(2);
    expect(valueInputs).toHaveLength(2);
  });

  it('should allow typing in run name input', async () => {
    const user = userEvent.setup();
    render(<PublishPage xmlContent={null} />);

    const runInput = screen.getByLabelText('Run Name');
    await user.type(runInput, 'Test Run 1');
    expect(runInput).toHaveValue('Test Run 1');
  });

  it('should allow typing in title input', async () => {
    const user = userEvent.setup();
    render(<PublishPage xmlContent={null} />);

    const titleInput = screen.getByLabelText('Title');
    await user.type(titleInput, 'My Test Title');
    expect(titleInput).toHaveValue('My Test Title');
  });

  it('should allow typing in metadata inputs', async () => {
    const user = userEvent.setup();
    render(<PublishPage xmlContent={null} />);

    const metaKey0 = screen.getByPlaceholderText('e.g., Failed Tests');
    const metaVal0 = screen.getByPlaceholderText('e.g., 54');
    const metaKey1 = screen.getByPlaceholderText('e.g., Executed By');
    const metaVal1 = screen.getByPlaceholderText('e.g., Brian');

    await user.type(metaKey0, 'Failed Tests');
    await user.type(metaVal0, '10');
    await user.type(metaKey1, 'Executed By');
    await user.type(metaVal1, 'Alice');

    expect(metaKey0).toHaveValue('Failed Tests');
    expect(metaVal0).toHaveValue('10');
    expect(metaKey1).toHaveValue('Executed By');
    expect(metaVal1).toHaveValue('Alice');
  });

  it('should not show loaded XML option when xmlContent is null', () => {
    render(<PublishPage xmlContent={null} />);

    expect(screen.queryByText('Use loaded XML file from Dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('Choose a new XML file')).toBeInTheDocument();
  });

  it('should show loaded XML option when xmlContent is provided', () => {
    render(<PublishPage xmlContent="<test>xml</test>" />);

    expect(screen.getByText('Use loaded XML file from Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Choose a new XML file')).toBeInTheDocument();
  });

  it('should default to loaded XML source when xmlContent is provided', () => {
    render(<PublishPage xmlContent="<test>xml</test>" />);

    const loadedRadio = screen.getByDisplayValue('loaded');
    const fileRadio = screen.getByDisplayValue('file');

    expect(loadedRadio).toBeChecked();
    expect(fileRadio).not.toBeChecked();
  });

  it('should default to file XML source when xmlContent is null', () => {
    render(<PublishPage xmlContent={null} />);

    const fileRadio = screen.getByDisplayValue('file');
    expect(fileRadio).toBeChecked();
  });

  it('should switch XML source when radio buttons are clicked', async () => {
    render(<PublishPage xmlContent="<test>xml</test>" />);

    const fileRadio = screen.getByDisplayValue('file');
    fireEvent.click(fileRadio);
    expect(fileRadio).toBeChecked();

    const loadedRadio = screen.getByDisplayValue('loaded');
    fireEvent.click(loadedRadio);
    expect(loadedRadio).toBeChecked();
  });

  it('should show file chooser button when file source is selected', () => {
    render(<PublishPage xmlContent={null} />);

    expect(screen.getByText('Select XML File')).toBeInTheDocument();
  });

  it('should hide file chooser when loaded source is selected', () => {
    render(<PublishPage xmlContent="<test>xml</test>" />);

    // loaded is default when xmlContent provided
    expect(screen.queryByText('Select XML File')).not.toBeInTheDocument();
  });

  it('should show error when publishing without run name', async () => {
    const user = userEvent.setup();
    render(<PublishPage xmlContent="<test>xml</test>" />);

    const titleInput = screen.getByLabelText('Title');
    await user.type(titleInput, 'My Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Run and Title are required fields.')).toBeInTheDocument();
    });
  });

  it('should show error when publishing without title', async () => {
    const user = userEvent.setup();
    render(<PublishPage xmlContent="<test>xml</test>" />);

    const runInput = screen.getByLabelText('Run Name');
    await user.type(runInput, 'My Run');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Run and Title are required fields.')).toBeInTheDocument();
    });
  });

  it('should show error when publishing without XML', async () => {
    const user = userEvent.setup();
    render(<PublishPage xmlContent={null} />);

    await user.type(screen.getByLabelText('Run Name'), 'My Run');
    await user.type(screen.getByLabelText('Title'), 'My Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Please provide an XML file for publishing.')).toBeInTheDocument();
    });
  });

  it('should publish successfully with loaded XML', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, stdout: 'Published successfully' }),
    });
    global.fetch = mockFetch;

    render(<PublishPage xmlContent="<test>xml content</test>" />);

    await user.type(screen.getByLabelText('Run Name'), 'My Run');
    await user.type(screen.getByLabelText('Title'), 'My Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Test results published successfully!')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('"run":"My Run"'),
    });
  });

  it('should publish with metadata filtered by non-empty keys', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, stdout: 'OK' }),
    });
    global.fetch = mockFetch;

    render(<PublishPage xmlContent="<test>xml</test>" />);

    await user.type(screen.getByLabelText('Run Name'), 'Run');
    await user.type(screen.getByLabelText('Title'), 'Title');
    await user.type(screen.getByPlaceholderText('e.g., Failed Tests'), 'MyKey');
    await user.type(screen.getByPlaceholderText('e.g., 54'), 'MyValue');
    // Leave second metadata entry empty

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.metadata).toHaveLength(1);
    expect(callBody.metadata[0]).toEqual({ key: 'MyKey', value: 'MyValue' });
  });

  it('should show error status on publish failure', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'Command failed', stderr: 'error output' }),
    });
    global.fetch = mockFetch;

    render(<PublishPage xmlContent="<test>xml</test>" />);

    await user.type(screen.getByLabelText('Run Name'), 'Run');
    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Command failed')).toBeInTheDocument();
    });
  });

  it('should show error when fetch throws', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = mockFetch;

    render(<PublishPage xmlContent="<test>xml</test>" />);

    await user.type(screen.getByLabelText('Run Name'), 'Run');
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

    render(<PublishPage xmlContent="<test>xml</test>" />);

    await user.type(screen.getByLabelText('Run Name'), 'Run');
    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Failed to publish. Is the dev server running?')).toBeInTheDocument();
    });
  });

  it('should display command output on success', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, stdout: 'Results published to Slack' }),
    });
    global.fetch = mockFetch;

    render(<PublishPage xmlContent="<test>xml</test>" />);

    await user.type(screen.getByLabelText('Run Name'), 'Run');
    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Results published to Slack')).toBeInTheDocument();
    });
  });

  it('should display stderr output on failure', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'Failed', stderr: 'detailed error info' }),
    });
    global.fetch = mockFetch;

    render(<PublishPage xmlContent="<test>xml</test>" />);

    await user.type(screen.getByLabelText('Run Name'), 'Run');
    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('detailed error info')).toBeInTheDocument();
    });
  });

  it('should show publishing state with spinner', async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: unknown) => void;
    const fetchPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    const mockFetch = vi.fn().mockReturnValue(fetchPromise);
    global.fetch = mockFetch;

    render(<PublishPage xmlContent="<test>xml</test>" />);

    await user.type(screen.getByLabelText('Run Name'), 'Run');
    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Publishing...')).toBeInTheDocument();
    });

    // Button should be disabled during publishing
    const publishButton = screen.getByText('Publishing...').closest('button');
    expect(publishButton).toBeDisabled();

    // Resolve the promise to clean up
    resolvePromise!({
      json: () => Promise.resolve({ success: true, stdout: 'done' }),
    });

    await waitFor(() => {
      expect(screen.getByText('Test results published successfully!')).toBeInTheDocument();
    });
  });

  it('should publish with file chooser XML', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, stdout: 'OK' }),
    });
    global.fetch = mockFetch;

    render(<PublishPage xmlContent={null} />);

    await user.type(screen.getByLabelText('Run Name'), 'Run');
    await user.type(screen.getByLabelText('Title'), 'Title');

    // Create and upload a file
    const xmlFile = createMockFile('<testsuites><testsuite name="s1"></testsuite></testsuites>', 'test.xml');
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
    expect(callBody.xmlContent).toBe('<testsuites><testsuite name="s1"></testsuite></testsuites>');
  });

  it('should use error message from API result when no specific error', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false }),
    });
    global.fetch = mockFetch;

    render(<PublishPage xmlContent="<test>xml</test>" />);

    await user.type(screen.getByLabelText('Run Name'), 'Run');
    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(screen.getByText('Publishing failed.')).toBeInTheDocument();
    });
  });

  it('should render success status with correct styling', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, stdout: 'done' }),
    });
    global.fetch = mockFetch;

    render(<PublishPage xmlContent="<test>xml</test>" />);

    await user.type(screen.getByLabelText('Run Name'), 'Run');
    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      const statusDiv = screen.getByTestId('publish-status');
      expect(statusDiv).toHaveClass('bg-green-50');
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    });
  });

  it('should render error status with correct styling', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'fail' }),
    });
    global.fetch = mockFetch;

    render(<PublishPage xmlContent="<test>xml</test>" />);

    await user.type(screen.getByLabelText('Run Name'), 'Run');
    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      const statusDiv = screen.getByTestId('publish-status');
      expect(statusDiv).toHaveClass('bg-red-50');
      expect(screen.getByTestId('x-circle-icon')).toBeInTheDocument();
    });
  });

  it('should set xmlSource to file when a file is selected even if loaded is default', async () => {
    const user = userEvent.setup();
    render(<PublishPage xmlContent="<test>xml</test>" />);

    // Initially loaded
    expect(screen.getByDisplayValue('loaded')).toBeChecked();

    // Switch to file mode
    fireEvent.click(screen.getByDisplayValue('file'));

    // Upload a file
    const xmlFile = createMockFile('<test/>', 'chosen.xml');
    const fileInput = screen.getByTestId('xml-file-input');
    await user.upload(fileInput, xmlFile);

    expect(screen.getByDisplayValue('file')).toBeChecked();
    expect(screen.getByText('chosen.xml')).toBeInTheDocument();
  });

  it('should handle both metadata entries being empty', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, stdout: 'OK' }),
    });
    global.fetch = mockFetch;

    render(<PublishPage xmlContent="<test>xml</test>" />);

    await user.type(screen.getByLabelText('Run Name'), 'Run');
    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.metadata).toHaveLength(0); // Both empty keys filtered out
  });

  it('should include xmlContent from loaded source in publish request', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, stdout: 'OK' }),
    });
    global.fetch = mockFetch;

    const xmlData = '<testsuite name="loaded"><testcase name="t1"/></testsuite>';
    render(<PublishPage xmlContent={xmlData} />);

    await user.type(screen.getByLabelText('Run Name'), 'Run');
    await user.type(screen.getByLabelText('Title'), 'Title');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.xmlContent).toBe(xmlData);
  });

  it('should trim whitespace from run and title before sending', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, stdout: 'OK' }),
    });
    global.fetch = mockFetch;

    render(<PublishPage xmlContent="<test/>" />);

    await user.type(screen.getByLabelText('Run Name'), '  My Run  ');
    await user.type(screen.getByLabelText('Title'), '  My Title  ');

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.run).toBe('My Run');
    expect(callBody.title).toBe('My Title');
  });
});
