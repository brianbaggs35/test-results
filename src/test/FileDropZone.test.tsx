import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileDropZone } from '../components/shared/FileDropZone';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  UploadIcon: () => <div data-testid="upload-icon" />,
  FileIcon: () => <div data-testid="file-icon" />,
  AlertCircleIcon: ({ className }: { className?: string }) => <div data-testid="alert-circle-icon" className={className} />,
  LoaderIcon: ({ className }: { className?: string }) => <div data-testid="loader-icon" className={className} />,
}));

describe('FileDropZone', () => {
  it('should render the compact loading state', () => {
    render(
      <FileDropZone
        onFileSelect={vi.fn()}
        accept=".json"
        variant="compact"
        isLoading
        loadingLabel="Loading export..."
        idleLabel="Export A"
      />
    );

    expect(screen.getByText('Loading export...')).toBeInTheDocument();
    expect(screen.getByTestId('loader-icon')).toHaveClass('size-6');
  });

  it('should render the compact error state and retry via the Try Again button', () => {
    const onFileSelect = vi.fn();
    render(
      <FileDropZone
        onFileSelect={onFileSelect}
        accept=".json"
        variant="compact"
        error="Could not read file"
        idleLabel="Export A"
      />
    );

    expect(screen.getByText('Could not read file')).toBeInTheDocument();
    expect(screen.getByTestId('alert-circle-icon')).toHaveClass('size-6');

    fireEvent.click(screen.getByText('Try Again'));
    // The button only opens the hidden native picker (a no-op in jsdom without a
    // real file); it shouldn't call onFileSelect on its own.
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('should show the upload illustration, not the file illustration, when nothing is selected yet', () => {
    render(
      <FileDropZone
        onFileSelect={vi.fn()}
        accept=".json"
        variant="compact"
        idleLabel="Export A"
        selectedFileName={null}
      />
    );

    expect(screen.getAllByTestId('upload-icon').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('file-icon')).not.toBeInTheDocument();
    expect(screen.getByText('Click to choose a file')).toBeInTheDocument();
  });

  it('should not start a drag state while loading', () => {
    const { container } = render(
      <FileDropZone
        onFileSelect={vi.fn()}
        accept=".json"
        isLoading
        idleLabel="Upload file"
      />
    );

    const dropZone = container.firstChild as HTMLElement;
    fireEvent.dragOver(dropZone);

    expect(dropZone.className.split(' ')).not.toContain('border-primary');
  });

  it('should ignore a drop while loading', () => {
    const onFileSelect = vi.fn();
    const { container } = render(
      <FileDropZone
        onFileSelect={onFileSelect}
        accept=".json"
        isLoading
        idleLabel="Upload file"
      />
    );

    const dropZone = container.firstChild as HTMLElement;
    const file = new File(['{}'], 'export.json', { type: 'application/json' });
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('should show the file icon and the selected file name once a file is selected', () => {
    render(
      <FileDropZone
        onFileSelect={vi.fn()}
        accept=".json"
        idleLabel="Upload file"
        selectedFileName="export.json"
      />
    );

    // The large status icon switches to FileIcon; the button keeps its own UploadIcon regardless.
    expect(screen.getByTestId('file-icon')).toBeInTheDocument();
    expect(screen.getByText('export.json')).toBeInTheDocument();
  });

  it('should not open the file picker by clicking the drop zone while loading', () => {
    const { container } = render(
      <FileDropZone
        onFileSelect={vi.fn()}
        accept=".json"
        isLoading
        idleLabel="Upload file"
      />
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    fireEvent.click(container.firstChild as HTMLElement);

    expect(clickSpy).not.toHaveBeenCalled();
  });
});
