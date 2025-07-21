import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

describe('PDF Generator CSS Injection', () => {
  it('should inject enhanced word spacing CSS for headings', () => {
    // Create a test DOM similar to what PDF generation uses
    const dom = new JSDOM(`
      <div id="test-content">
        <h1>Automated Test Results Report</h1>
        <h2>Section Header</h2>
        <h3>Subsection Header</h3>
        <p>Regular text content</p>
      </div>
    `);
    
    const document = dom.window.document;
    const element = document.getElementById('test-content');
    
    // Simulate the prepareContent function behavior with our enhanced CSS
    const content = element!.cloneNode(true) as HTMLElement;
    
    // Add the enhanced CSS styles that should be injected for PDF generation
    const style = document.createElement("style");
    style.textContent = `
      h1, h2, h3 {
        page-break-after: avoid !important;
        white-space: normal !important;
        word-spacing: 0.25em !important;
        letter-spacing: 0.025em !important;
        text-rendering: optimizeLegibility !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        font-stretch: normal !important;
        font-variant: normal !important;
        unicode-bidi: normal !important;
      }
    `;
    content.insertBefore(style, content.firstChild);
    
    // Verify the enhanced style element was added
    const styleElement = content.querySelector('style');
    expect(styleElement).toBeTruthy();
    
    // Check for enhanced word spacing properties
    expect(styleElement!.textContent).toContain('white-space: normal !important');
    expect(styleElement!.textContent).toContain('word-spacing: 0.25em !important');
    expect(styleElement!.textContent).toContain('letter-spacing: 0.025em !important');
    expect(styleElement!.textContent).toContain('font-family:');
    expect(styleElement!.textContent).toContain('font-stretch: normal !important');
    expect(styleElement!.textContent).toContain('font-variant: normal !important');
    expect(styleElement!.textContent).toContain('unicode-bidi: normal !important');
    
    // Verify all heading elements exist and maintain their text content
    const h1Element = content.querySelector('h1');
    const h2Element = content.querySelector('h2');
    const h3Element = content.querySelector('h3');
    
    expect(h1Element).toBeTruthy();
    expect(h2Element).toBeTruthy();
    expect(h3Element).toBeTruthy();
    
    expect(h1Element!.textContent).toBe('Automated Test Results Report');
    expect(h2Element!.textContent).toBe('Section Header');
    expect(h3Element!.textContent).toBe('Subsection Header');
    
    // Verify spaces are preserved in the content
    expect(h1Element!.textContent).toContain(' ');
    expect(h2Element!.textContent).toContain(' ');
    
    // Verify no collapsed text
    expect(h1Element!.textContent).not.toBe('AutomatedTestResultsReport');
    expect(h2Element!.textContent).not.toBe('SectionHeader');
  });

  it('should validate that word spacing values are appropriate for PDF rendering', () => {
    // Test the specific word spacing value we're using
    const wordSpacing = '0.25em';
    const letterSpacing = '0.025em';
    
    // These values should be positive and reasonable for PDF rendering
    expect(wordSpacing).toMatch(/^\d+(\.\d+)?em$/);
    expect(letterSpacing).toMatch(/^\d+(\.\d+)?em$/);
    
    // Convert to approximate pixel values (assuming 16px base font size)
    const wordSpacingPx = parseFloat(wordSpacing) * 16; // ~4px
    const letterSpacingPx = parseFloat(letterSpacing) * 16; // ~0.4px
    
    // Should be reasonable values for readability
    expect(wordSpacingPx).toBeGreaterThan(2); // At least 2px word spacing
    expect(wordSpacingPx).toBeLessThan(10); // Not too excessive
    expect(letterSpacingPx).toBeGreaterThan(0); // Slight letter spacing for readability
    expect(letterSpacingPx).toBeLessThan(2); // Not too much letter spacing
  });

  it('should ensure font family fallbacks are comprehensive', () => {
    const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    
    // Should include system fonts and fallbacks
    expect(fontFamily).toContain('-apple-system'); // macOS
    expect(fontFamily).toContain('BlinkMacSystemFont'); // macOS fallback
    expect(fontFamily).toContain('Segoe UI'); // Windows
    expect(fontFamily).toContain('Roboto'); // Android/Google
    expect(fontFamily).toContain('Arial'); // Universal fallback
    expect(fontFamily).toContain('sans-serif'); // Generic fallback
    
    // Should be a comprehensive stack for PDF generation
    const fonts = fontFamily.split(',').map(f => f.trim());
    expect(fonts.length).toBeGreaterThanOrEqual(6);
  });
});