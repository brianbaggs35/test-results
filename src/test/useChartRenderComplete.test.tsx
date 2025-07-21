import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChartRenderComplete } from '../hooks/useChartRenderComplete';

// Mock MutationObserver
const mockDisconnect = vi.fn();
const mockObserve = vi.fn();
const mockMutationCallback = vi.fn();

class MockMutationObserver {
  constructor(callback: MutationCallback) {
    mockMutationCallback.mockImplementation(callback);
  }
  observe = mockObserve;
  disconnect = mockDisconnect;
}

Object.defineProperty(global, 'MutationObserver', {
  value: MockMutationObserver,
  writable: true
});

describe('useChartRenderComplete', () => {
  beforeEach(() => {
    // Clean up any existing chart-render-complete elements
    const existingElements = document.querySelectorAll('.chart-render-complete');
    existingElements.forEach(el => el.remove());
    
    // Reset mocks
    mockDisconnect.mockClear();
    mockObserve.mockClear();
    mockMutationCallback.mockClear();
    
    // Mock setTimeout and clearTimeout
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Clean up after each test
    const existingElements = document.querySelectorAll('.chart-render-complete');
    existingElements.forEach(el => el.remove());
    
    vi.useRealTimers();
  });

  it('should add chart-render-complete element when chart container exists', () => {
    // Add a mock chart container to the DOM
    const chartContainer = document.createElement('div');
    chartContainer.className = 'recharts-responsive-container';
    document.body.appendChild(chartContainer);

    renderHook(() => useChartRenderComplete([]));

    // Verify MutationObserver was set up
    expect(mockObserve).toHaveBeenCalledWith(chartContainer, {
      childList: true,
      attributes: true,
      subtree: true
    });

    // Verify chart-render-complete element was added
    const indicator = document.querySelector('.chart-render-complete');
    expect(indicator).toBeTruthy();

    // Clean up
    chartContainer.remove();
  });

  it('should use timeout fallback when no chart container exists', () => {
    renderHook(() => useChartRenderComplete([]));

    // No chart container, should not call observe
    expect(mockObserve).not.toHaveBeenCalled();

    // Fast-forward timers to trigger timeout
    act(() => {
      vi.advanceTimersByTime(50);
    });

    // Verify chart-render-complete element was added after timeout
    const indicator = document.querySelector('.chart-render-complete');
    expect(indicator).toBeTruthy();
  });

  it('should handle MutationObserver mutations', () => {
    // Add a mock chart container to the DOM
    const chartContainer = document.createElement('div');
    chartContainer.className = 'recharts-responsive-container';
    document.body.appendChild(chartContainer);

    renderHook(() => useChartRenderComplete([]));

    // Simulate a mutation
    const mockMutations = [
      {
        type: 'childList' as MutationType,
        target: chartContainer,
        addedNodes: [] as NodeList,
        removedNodes: [] as NodeList,
        previousSibling: null,
        nextSibling: null,
        attributeName: null,
        attributeNamespace: null,
        oldValue: null
      }
    ];

    // Trigger the mutation callback
    act(() => {
      mockMutationCallback(mockMutations, null as unknown as MutationObserver);
    });

    // Should add chart-render-complete element
    const indicator = document.querySelector('.chart-render-complete');
    expect(indicator).toBeTruthy();

    // Clean up
    chartContainer.remove();
  });

  it('should handle attribute mutations', () => {
    // Add a mock chart container to the DOM
    const chartContainer = document.createElement('div');
    chartContainer.className = 'recharts-responsive-container';
    document.body.appendChild(chartContainer);

    renderHook(() => useChartRenderComplete([]));

    // Simulate an attributes mutation
    const mockMutations = [
      {
        type: 'attributes' as MutationType,
        target: chartContainer,
        addedNodes: [] as NodeList,
        removedNodes: [] as NodeList,
        previousSibling: null,
        nextSibling: null,
        attributeName: 'class',
        attributeNamespace: null,
        oldValue: null
      }
    ];

    // Trigger the mutation callback
    act(() => {
      mockMutationCallback(mockMutations, null as unknown as MutationObserver);
    });

    // Should add chart-render-complete element
    const indicator = document.querySelector('.chart-render-complete');
    expect(indicator).toBeTruthy();

    // Clean up
    chartContainer.remove();
  });

  it('should not add duplicate chart-render-complete elements', () => {
    // Pre-add a chart-render-complete element
    const existing = document.createElement('div');
    existing.className = 'chart-render-complete';
    document.body.appendChild(existing);

    renderHook(() => useChartRenderComplete([]));

    // Fast-forward timers to trigger timeout
    act(() => {
      vi.advanceTimersByTime(50);
    });

    // Should still only have one element
    const indicators = document.querySelectorAll('.chart-render-complete');
    expect(indicators.length).toBe(1);
  });

  it('should disconnect observer on cleanup', () => {
    // Add a mock chart container to the DOM
    const chartContainer = document.createElement('div');
    chartContainer.className = 'recharts-responsive-container';
    document.body.appendChild(chartContainer);

    const { unmount } = renderHook(() => useChartRenderComplete([]));

    // Unmount to trigger cleanup
    unmount();

    // Verify observer was disconnected
    expect(mockDisconnect).toHaveBeenCalled();

    // Clean up
    chartContainer.remove();
  });

  it('should clear timeout on cleanup', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    
    const { unmount } = renderHook(() => useChartRenderComplete([]));

    // Unmount to trigger cleanup
    unmount();

    // Verify timeout was cleared
    expect(clearTimeoutSpy).toHaveBeenCalled();
    
    clearTimeoutSpy.mockRestore();
  });

  it('should find chart container by data-testid', () => {
    // Add a mock chart container with data-testid
    const chartContainer = document.createElement('div');
    chartContainer.setAttribute('data-testid', 'responsive-container');
    document.body.appendChild(chartContainer);

    renderHook(() => useChartRenderComplete([]));

    // Verify MutationObserver was set up
    expect(mockObserve).toHaveBeenCalledWith(chartContainer, {
      childList: true,
      attributes: true,
      subtree: true
    });

    // Clean up
    chartContainer.remove();
  });

  it('should re-run effect when dependencies change', () => {
    let dependencies = ['test1'];
    
    const { rerender } = renderHook(() => useChartRenderComplete(dependencies));

    // Verify initial setup
    expect(mockObserve).toHaveBeenCalledTimes(0); // No chart container initially

    // Change dependencies
    dependencies = ['test2'];
    rerender();

    // The effect should have been called again, but since no chart container exists,
    // it should use the timeout fallback both times
    // We can verify by checking if elements are created
    act(() => {
      vi.advanceTimersByTime(50);
    });

    const indicator = document.querySelector('.chart-render-complete');
    expect(indicator).toBeTruthy();
  });
});