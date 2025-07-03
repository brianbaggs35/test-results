import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileUploader } from '../components/Dashboard/FileUploader';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  UploadIcon: () => <div data-testid="upload-icon" />,
  FileIcon: () => <div data-testid="file-icon" />,
  AlertCircleIcon: () => <div data-testid="alert-circle-icon" />,
  LoaderIcon: ({ className }: { className?: string }) => <div data-testid="loader-icon" className={className} />,
}));

describe('FileUploader', () => {
  const mockOnFileUpload = vi.fn();

  beforeEach(() => {
    mockOnFileUpload.mockClear();
  });

  it('should render upload interface in default state', () => {
    render(<FileUploader onFileUpload={mockOnFileUpload} isLoading={false} error={null} />);
    
    expect(screen.getByText('Upload JUnit XML File')).toBeInTheDocument();
    expect(screen.getByText('Drag and drop or click to upload')).toBeInTheDocument();
    expect(screen.getByText('Select File')).toBeInTheDocument();
    expect(screen.getByTestId('file-icon')).toBeInTheDocument();
    expect(screen.getByTestId('upload-icon')).toBeInTheDocument();
  });

  it('should show loading state when isLoading is true', () => {
    render(<FileUploader onFileUpload={mockOnFileUpload} isLoading={true} error={null} />);
    
    expect(screen.getByText('Processing your file...')).toBeInTheDocument();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    expect(screen.getByTestId('loader-icon')).toHaveClass('animate-spin');
    
    // Should not show upload interface
    expect(screen.queryByText('Upload JUnit XML File')).not.toBeInTheDocument();
    expect(screen.queryByText('Select File')).not.toBeInTheDocument();
  });

  it('should show error state when error is provided', () => {
    const errorMessage = 'Invalid file format';
    render(<FileUploader onFileUpload={mockOnFileUpload} isLoading={false} error={errorMessage} />);
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
    
    // Should not show upload interface
    expect(screen.queryByText('Upload JUnit XML File')).not.toBeInTheDocument();
    expect(screen.queryByText('Select File')).not.toBeInTheDocument();
  });

  it('should have hidden file input with correct attributes', () => {
    render(<FileUploader onFileUpload={mockOnFileUpload} isLoading={false} error={null} />);
    
    const fileInput = screen.getByDisplayValue('') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput.type).toBe('file');
    expect(fileInput.accept).toBe('.xml');
    expect(fileInput).toHaveClass('hidden');
  });

  it('should trigger file input when Select File button is clicked', () => {
    render(<FileUploader onFileUpload={mockOnFileUpload} isLoading={false} error={null} />);
    
    const selectButton = screen.getByText('Select File');
    const fileInput = screen.getByDisplayValue('') as HTMLInputElement;
    
    // Mock the click method
    const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => { /* mock implementation */ });
    
    fireEvent.click(selectButton);
    
    expect(clickSpy).toHaveBeenCalled();
    
    clickSpy.mockRestore();
  });

  it('should trigger file input when Try Again button is clicked in error state', () => {
    render(<FileUploader onFileUpload={mockOnFileUpload} isLoading={false} error="Error message" />);
    
    const tryAgainButton = screen.getByText('Try Again');
    const fileInput = screen.getByDisplayValue('') as HTMLInputElement;
    
    // Mock the click method
    const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => { /* mock implementation */ });
    
    fireEvent.click(tryAgainButton);
    
    expect(clickSpy).toHaveBeenCalled();
    
    clickSpy.mockRestore();
  });

  it('should call onFileUpload when file is selected', () => {
    render(<FileUploader onFileUpload={mockOnFileUpload} isLoading={false} error={null} />);
    
    const fileInput = screen.getByDisplayValue('') as HTMLInputElement;
    const file = new File(['test content'], 'test.xml', { type: 'text/xml' });
    
    // Mock the files property
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    expect(mockOnFileUpload).toHaveBeenCalledWith(file);
    expect(mockOnFileUpload).toHaveBeenCalledTimes(1);
  });

  it('should not call onFileUpload when no file is selected', () => {
    render(<FileUploader onFileUpload={mockOnFileUpload} isLoading={false} error={null} />);
    
    const fileInput = screen.getByDisplayValue('') as HTMLInputElement;
    
    // Mock the files property as empty
    Object.defineProperty(fileInput, 'files', {
      value: [],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    expect(mockOnFileUpload).not.toHaveBeenCalled();
  });

  it('should handle multiple files by taking only the first one', () => {
    render(<FileUploader onFileUpload={mockOnFileUpload} isLoading={false} error={null} />);
    
    const fileInput = screen.getByDisplayValue('') as HTMLInputElement;
    const file1 = new File(['test content 1'], 'test1.xml', { type: 'text/xml' });
    const file2 = new File(['test content 2'], 'test2.xml', { type: 'text/xml' });
    
    // Mock the files property with multiple files
    Object.defineProperty(fileInput, 'files', {
      value: [file1, file2],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    expect(mockOnFileUpload).toHaveBeenCalledWith(file1);
    expect(mockOnFileUpload).toHaveBeenCalledTimes(1);
  });

  it('should display long error messages correctly', () => {
    const longError = 'This is a very long error message that should be displayed properly in the error state component';
    render(<FileUploader onFileUpload={mockOnFileUpload} isLoading={false} error={longError} />);
    
    expect(screen.getByText(longError)).toBeInTheDocument();
  });

  it('should have proper styling classes', () => {
    const { container } = render(<FileUploader onFileUpload={mockOnFileUpload} isLoading={false} error={null} />);
    
    const uploaderDiv = container.firstChild as HTMLElement;
    expect(uploaderDiv).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center', 'p-6', 'border-2', 'border-dashed', 'border-gray-300', 'rounded-lg', 'bg-gray-50');
  });
});