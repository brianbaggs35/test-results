// Simple test to verify chart-render-complete functionality
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { TestMetrics } from '../components/Dashboard/TestMetrics';
import { PDFPreviewFrame } from '../components/ReportGenerator/PDFPreviewFrame';

const mockTestData = {
  summary: {
    total: 100,
    passed: 85,
    failed: 10,
    skipped: 5,
    time: 123.45
  },
  suites: []
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

describe('Chart Render Complete', () => {
  beforeEach(() => {
    // Clean up any existing chart-render-complete elements
    const existingElements = document.querySelectorAll('.chart-render-complete');
    existingElements.forEach(el => el.remove());
  });

  afterEach(() => {
    // Clean up after each test
    const existingElements = document.querySelectorAll('.chart-render-complete');
    existingElements.forEach(el => el.remove());
  });

  it('should add chart-render-complete class when TestMetrics renders', async () => {
    render(React.createElement(TestMetrics, { testData: mockTestData }));
    
    // Wait for the useEffect to run and add the class
    await waitFor(() => {
      const indicator = document.querySelector('.chart-render-complete');
      expect(indicator).toBeTruthy();
    }, { timeout: 500 });
  });

  it('should add chart-render-complete class when PDFPreviewFrame renders', async () => {
    render(React.createElement(PDFPreviewFrame, { testData: mockTestData, config: mockConfig }));
    
    // Wait for the useEffect to run and add the class
    await waitFor(() => {
      const indicator = document.querySelector('.chart-render-complete');
      expect(indicator).toBeTruthy();
    }, { timeout: 500 });
  });

  it('should handle chart container with MutationObserver', async () => {
    // Add a mock chart container to the DOM
    const chartContainer = document.createElement('div');
    chartContainer.className = 'recharts-responsive-container';
    document.body.appendChild(chartContainer);

    render(React.createElement(TestMetrics, { testData: mockTestData }));
    
    // Wait for the useEffect to run
    await waitFor(() => {
      const indicator = document.querySelector('.chart-render-complete');
      expect(indicator).toBeTruthy();
    }, { timeout: 500 });

    // Clean up
    chartContainer.remove();
  });

  it('should use fallback timeout when no chart container is found', async () => {
    render(React.createElement(TestMetrics, { testData: mockTestData }));
    
    // Wait for the timeout to trigger
    await waitFor(() => {
      const indicator = document.querySelector('.chart-render-complete');
      expect(indicator).toBeTruthy();
    }, { timeout: 500 });
  });

  it('should not add duplicate chart-render-complete elements', async () => {
    // Render the component twice
    render(React.createElement(TestMetrics, { testData: mockTestData }));
    render(React.createElement(TestMetrics, { testData: mockTestData }));
    
    await waitFor(() => {
      const indicators = document.querySelectorAll('.chart-render-complete');
      expect(indicators.length).toBe(1); // Should only have one
    }, { timeout: 500 });
  });

  it('should handle existing chart-render-complete element', async () => {
    // Pre-add a chart-render-complete element
    const existing = document.createElement('div');
    existing.className = 'chart-render-complete';
    document.body.appendChild(existing);

    render(React.createElement(TestMetrics, { testData: mockTestData }));
    
    await waitFor(() => {
      const indicators = document.querySelectorAll('.chart-render-complete');
      expect(indicators.length).toBe(1); // Should still only have one
    }, { timeout: 500 });
  });
});