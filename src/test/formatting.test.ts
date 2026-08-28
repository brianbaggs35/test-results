import { describe, it, expect } from 'vitest';
import { formatDuration, formatPercent } from '../utils/formatting';

describe('formatDuration', () => {
  it('should format seconds only', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('should format zero seconds', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('should format minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(125)).toBe('2m 5s');
  });

  it('should format hours, minutes and seconds', () => {
    expect(formatDuration(3661)).toBe('1h 1m 1s');
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(3660)).toBe('1h 1m');
    expect(formatDuration(7322)).toBe('2h 2m 2s');
  });

  it('should handle decimal seconds by flooring', () => {
    expect(formatDuration(30.9)).toBe('30s');
    expect(formatDuration(61.5)).toBe('1m 1s');
    expect(formatDuration(3661.99)).toBe('1h 1m 1s');
  });

  it('should handle large numbers', () => {
    expect(formatDuration(36000)).toBe('10h');
    expect(formatDuration(90061)).toBe('25h 1m 1s');
  });
});

describe('formatPercent', () => {
  it('should format to two decimal places', () => {
    expect(formatPercent(1, 2)).toBe('50.00');
    expect(formatPercent(1, 4)).toBe('25.00');
  });

  it('should floor rather than round to nearest, so it never overstates the real rate', () => {
    // 99.727...% — rounding to nearest would give "99.73", floor gives "99.72".
    expect(formatPercent(6578, 6596)).toBe('99.72');
    // 99.995...% — rounding to nearest at 2dp would give a misleading "100.00".
    expect(formatPercent(19999, 20000)).toBe('99.99');
  });

  it('should return 0.00 for a zero total instead of dividing by zero', () => {
    expect(formatPercent(0, 0)).toBe('0.00');
  });

  it('should treat a value/1 pair as an already-computed fraction', () => {
    // The recharts pie-label renderer hands back a 0-1 fraction rather than a
    // value/total pair — passing 1 as the total reuses the same formula for it.
    expect(formatPercent(0.7143, 1)).toBe('71.43');
  });

  it('should sum to the true total across a full breakdown, unlike 1-decimal rounding', () => {
    // The exact scenario that motivated this: 3723/3740 passed, 5 failed, 3 flaky,
    // 9 skipped — at 1 decimal this summed to 99.9%, not 100%.
    const total = 3740;
    const parts = [3723, 5, 3, 9].map((n) => Number(formatPercent(n, total)));
    const sum = parts.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 1);
  });
});