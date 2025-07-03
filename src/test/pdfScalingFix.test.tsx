import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    
    const pdfFrame = document.getElementById('pdf-preview-frame');
    expect(pdfFrame).toBeInTheDocument();
    
    // Check that the frame has the correct width for A4 fitting
    const styles = window.getComputedStyle(pdfFrame!);
    const width = pdfFrame!.style.width;
    
    // Should be 190mm (A4 width 210mm - 20mm for margins)
    expect(width).toBe('190mm');
  });

  it('should have uniform padding that fits within A4 margins', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    
    const pdfFrame = document.getElementById('pdf-preview-frame');
    expect(pdfFrame).toBeInTheDocument();
    
    // Check that padding is uniform 10mm on all sides (browser condenses to '10mm')
    const padding = pdfFrame!.style.padding;
    expect(padding).toBe('10mm');
  });

  it('should not exceed A4 page boundaries', () => {
    render(<PDFPreviewFrame testData={mockTestData} config={mockConfig} />);
    
    const pdfFrame = document.getElementById('pdf-preview-frame');
    expect(pdfFrame).toBeInTheDocument();
    
    // A4 width is 210mm, our frame should be 190mm + 20mm padding = 210mm total
    const width = parseInt(pdfFrame!.style.width.replace('mm', ''));
    const padding = 20; // 10mm on each side
    const totalWidth = width + padding;
    
    // Should not exceed A4 width of 210mm
    expect(totalWidth).toBeLessThanOrEqual(210);
  });
});