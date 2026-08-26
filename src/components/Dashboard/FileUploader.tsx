import { FileDropZone } from '@/components/shared/FileDropZone';

interface FileUploaderProps {
  onFileUpload: (file: File) => void;
  isLoading: boolean;
  error: string | null;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileUpload, isLoading, error }) => {
  return (
    <FileDropZone
      onFileSelect={onFileUpload}
      accept=".xml"
      isLoading={isLoading}
      error={error}
      idleLabel="Upload JUnit XML File"
      idleHint="Drag and drop or click to upload"
      loadingLabel="Processing your file..."
      aria-label="Upload XML file"
      inputId="file-upload"
    />
  );
};
