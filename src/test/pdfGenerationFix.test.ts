import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { TestMetrics } from '../components/Dashboard/TestMetrics';
import { PDFPreviewFrame } from '../components/ReportGenerator/PDFPreviewFrame';

const mockTestData = {
  summary: {
    total: 10,
    passed: 8,
    failed: 1,
    skipped: 1,
    time: 25.5
  },
  suites: [
    {
      name: 'Test Suite',
      tests: 10,
      failures: 1,
      errors: 0,
      skipped: 1,
      time: 25.5,
      timestamp: '2024-01-01T12:00:00Z',
      testcases: [
        { name: 'Test 1', status: "passed" as const, suite: 'Test Suite', time: 2.5 },
        { name: 'Test 2', status: "failed" as const, suite: 'Test Suite', time: 3.0, errorMessage: 'Test failed' }
      ]
    }
  ]
};

const mockConfig = {
  title: 'Test Report',
  projectName: 'Test Project',
  author: 'Test Author',
  includeExecutiveSummary: true,
  includeTestMetrics: true,
  includeFailedTests: true,
  includeAllTests: false,
  includeResolutionProgress: false
};

describe('PDF Generation Chart Render Complete Fix', () => {
  let originalHtml2pdf: unknown;

  beforeEach(() => {
    // Clean up any existing chart-render-complete elements
    const existingElements = document.querySelectorAll('.chart-render-complete');
    existingElements.forEach(el => el.remove());

    // Save the original window.html2pdf value
    originalHtml2pdf = ((window as unknown) as Record<string, unknown>).html2pdf;
  });

  afterEach(() => {
    // Clean up after each test
    const existingElements = document.querySelectorAll('.chart-render-complete');
    existingElements.forEach(el => el.remove());

    // Restore the original window.html2pdf value
    ((window as unknown) as Record<string, unknown>).html2pdf = originalHtml2pdf;
  });

  it('should verify PDF generation can proceed when chart-render-complete class exists', async () => {
    // Render a component that adds the chart-render-complete class
    render(React.createElement(TestMetrics, { testData: mockTestData }));

    // Wait for the chart-render-complete class to be added
    const indicator = await waitFor(() => document.querySelector('.chart-render-complete'));

    // Verify the chart-render-complete class was added
    expect(indicator).toBeTruthy();
    expect(indicator).toBeTruthy();
    expect(indicator?.className).toBe('chart-render-complete');

    // Mock PDF generation components
    const mockReportElement = document.createElement('div');
    mockReportElement.id = 'report-preview';
    mockReportElement.innerHTML = '<div>Test content</div>';
    document.body.appendChild(mockReportElement);

    // Mock html2pdf
    const mockHtml2Pdf = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      save: vi.fn().mockResolvedValue(undefined)
    });

    Object.defineProperty(window, 'html2pdf', {
      writable: true,
      value: mockHtml2Pdf
    });

    // Import and test the PDF generator
    const { generatePDF } = await import('../components/ReportGenerator/pdfGenerator');

    // This should not timeout since chart-render-complete class exists
    await expect(generatePDF(mockTestData, mockConfig)).resolves.not.toThrow();

    // Cleanup
    document.body.removeChild(mockReportElement);
  });

  it('should verify PDFPreviewFrame also adds chart-render-complete class', async () => {
    // Render PDFPreviewFrame which should also add the chart-render-complete class
    render(React.createElement(PDFPreviewFrame, { testData: mockTestData, config: mockConfig }));

    // Wait for the chart-render-complete class to be added
    const indicator = await waitFor(() => {
      const element = document.querySelector('.chart-render-complete');
      expect(element).toBeTruthy();
      return element;
    });

    expect(indicator?.className).toBe('chart-render-complete');
  });
});