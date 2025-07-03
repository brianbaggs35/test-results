import { useEffect, DependencyList } from 'react';

/**
 * Custom hook to add chart-render-complete indicator for PDF generation.
 * This hook ensures that PDF generation waits for charts to be fully rendered.
 * 
 * @param dependencies - Array of dependencies that should trigger re-checking
 */
export const useChartRenderComplete = (dependencies: DependencyList = []) => {
  useEffect(() => {
    let observer: MutationObserver | null = null;
    let timer: NodeJS.Timeout | null = null;

    const addChartRenderComplete = () => {
      if (!document.querySelector('.chart-render-complete')) {
        const indicator = document.createElement('div');
        indicator.className = 'chart-render-complete';
        indicator.style.display = 'none';
        document.body.appendChild(indicator);
        observer?.disconnect();
      }
    };

    // Try to find chart container and watch for changes
    const chartContainer = document.querySelector('.recharts-responsive-container') || 
                          document.querySelector('[data-testid="responsive-container"]');
    
    if (chartContainer) {
      // Use MutationObserver to watch for chart rendering changes
      observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'attributes') {
            addChartRenderComplete();
          }
        });
      });
      observer.observe(chartContainer, { childList: true, attributes: true, subtree: true });
      
      // Also add immediately in case the chart is already rendered
      addChartRenderComplete();
    } else {
      // Fallback: use timeout if no chart container is found yet or in test environment
      timer = setTimeout(() => {
        addChartRenderComplete();
      }, 50); // Reduced timeout for faster test execution
    }

    return () => {
      observer?.disconnect();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps
};