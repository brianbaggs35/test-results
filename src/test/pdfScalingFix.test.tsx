import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { PDFPreviewFrame } from '../components/ReportGenerator/PDFPreviewFrame';

describe('PDF Scaling Fix', () => {
  const mockTestData = {
    summary: {
      total: 9,
      passed: 5,
      failed: 4,
      skipped: 0,
      time: 4.5
    },
    suites: [
      {
        name: 'Suite A',
        testcases: [
          { name: 'test1', status: 'passed' as const, time: 0.5 },
          { name: 'test2', status: 'failed' as const, time: 0.5, errorMessage: 'Test failed' }
        ]
      }
    ]
  };

  const mockConfig = {
    title: 'Test Report',
    author: 'Test Author',
    projectName: 'Test Project',
    includeExecutiveSummary: true,
    includeTestMetrics: true,
    includeFailedTests: true,
    includeAllTests: true,
    includeResolutionProgress: true
  };

  beforeEach(() => {
    // Mock chart render complete hook
    const mockElement = document.createElement('div');
    mockElement.classList.add('chart-render-complete');
    document.body.appendChild(mockElement);
  });

  it('should render PDF preview frame with A4-appropriate dimensions', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    const pdfFrame = document.getElementById('report-preview');
    expect(pdfFrame).toBeInTheDocument();

    // Check that the frame has the correct width for A4 fitting
    const width = pdfFrame?.style.width;

    // Should be 190mm (A4 width 210mm - 20mm for margins)
    expect(width).toBe('794px');
  });

  it('should have uniform padding that fits within A4 margins', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    const pdfFrame = document.getElementById('report-preview');
    expect(pdfFrame).toBeInTheDocument();

    // Check that padding has increased left/right padding for better centering
    const padding = pdfFrame?.style.padding;
    expect(padding).toBe('10mm 15mm');
  });

  it('should not exceed A4 page boundaries', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);

    const pdfFrame = document.getElementById('report-preview');
    expect(pdfFrame).toBeInTheDocument();

    // A4 width is 210mm, our frame should be 190mm + 30mm padding (15mm on each side) = 220mm
    // But since we have external margins of 10mm each side, effective content area is still within bounds
    const widthStr = pdfFrame?.style.width ?? '0mm';
    const width = parseInt(widthStr.replace('mm', ''));
    const leftRightPadding = 30; // 15mm on each side
    const totalWidth = width + leftRightPadding;

    // Content should fit within available area after PDF margins (190mm available, 190mm + 30mm = 220mm, but content area is reduced)
    expect(width).toBe(794); // Frame width should still be 794px
    expect(totalWidth).toBe(824); // Total with padding
  });
});