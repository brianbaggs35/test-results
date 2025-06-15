import { describe, it, expect } from 'vitest';
import { formatDuration } from '../utils/formatting';

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