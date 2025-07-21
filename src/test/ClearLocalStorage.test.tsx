import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ClearLocalStorageButton from '../components/Dashboard/ClearLocalStorage';

describe('ClearLocalStorageButton', () => {
  // Mock localStorage
  const mockLocalStorage = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => mockLocalStorage.store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      mockLocalStorage.store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockLocalStorage.store[key];
    }),
    clear: vi.fn(() => {
      mockLocalStorage.store = {};
    }),
    get length() {
      return Object.keys(this.store).length;
    },
    key: vi.fn((index: number) => Object.keys(mockLocalStorage.store)[index] || null)
  };

  // Mock Object.keys to work with our mock localStorage
  const originalObjectKeys = Object.keys;
  
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    // Mock Object.keys to return our mock localStorage keys
    Object.keys = vi.fn((obj) => {
      if (obj === localStorage) {
        return Object.keys(mockLocalStorage.store);
      }
      return originalObjectKeys(obj);
    });

    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      value: {
        reload: vi.fn(),
      },
      writable: true,
    });

    // Mock alert
    window.alert = vi.fn();

    // Reset mocks
    vi.clearAllMocks();
    mockLocalStorage.store = {};
  });

  afterEach(() => {
    Object.keys = originalObjectKeys;
    vi.restoreAllMocks();
  });

  it('should render Clear Test Data button', () => {
    render(<ClearLocalStorageButton />);
    
    expect(screen.getByRole('button', { name: 'Clear Test Data' })).toBeInTheDocument();
  });

  it('should clear localStorage items with testFixProgress prefix when clicked', () => {
    // Set up localStorage with test data
    mockLocalStorage.store = {
      'testFixProgress_item1': 'value1',
      'testFixProgress_item2': 'value2',
      'otherData': 'shouldNotBeRemoved',
      'testFixProgress': 'value3',
    };

    render(<ClearLocalStorageButton />);
    
    const button = screen.getByRole('button', { name: 'Clear Test Data' });
    fireEvent.click(button);

    // Check that testFixProgress items were removed
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('testFixProgress_item1');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('testFixProgress_item2');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('testFixProgress');
    
    // Check that other items were not removed
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('otherData');
    
    // Should call removeItem 3 times (for the 3 testFixProgress items)
    expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(3);
  });

  it('should show alert message when clearing data', () => {
    render(<ClearLocalStorageButton />);
    
    const button = screen.getByRole('button', { name: 'Clear Test Data' });
    fireEvent.click(button);

    expect(window.alert).toHaveBeenCalledWith(
      'All loaded test data for this application has been cleared from local storage'
    );
  });

  it('should reload the page after clearing data', () => {
    render(<ClearLocalStorageButton />);
    
    const button = screen.getByRole('button', { name: 'Clear Test Data' });
    fireEvent.click(button);

    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  it('should handle empty localStorage gracefully', () => {
    // Empty localStorage
    mockLocalStorage.store = {};

    render(<ClearLocalStorageButton />);
    
    const button = screen.getByRole('button', { name: 'Clear Test Data' });
    fireEvent.click(button);

    // Should not call removeItem if no matching keys
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    
    // Should still show alert and reload
    expect(window.alert).toHaveBeenCalled();
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('should only remove items that start with testFixProgress prefix', () => {
    mockLocalStorage.store = {
      'testFixProgress': 'value1',
      'testFixProgressBackup': 'value2',
      'testFixProgress_123': 'value3',
      'testData': 'shouldNotBeRemoved',
      'other_testFixProgress': 'shouldNotBeRemoved',
      'prefixTestFixProgress': 'shouldNotBeRemoved',
    };

    render(<ClearLocalStorageButton />);
    
    const button = screen.getByRole('button', { name: 'Clear Test Data' });
    fireEvent.click(button);

    // Should remove items that start with the prefix
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('testFixProgress');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('testFixProgressBackup');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('testFixProgress_123');
    
    // Should NOT remove items that don't start with the prefix
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('testData');
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('other_testFixProgress');
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('prefixTestFixProgress');
    
    expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(3);
  });

  it('should have correct prefix constant', () => {
    // This tests that the PREFIX constant is used correctly
    mockLocalStorage.store = {
      'testFixProgress_test': 'value',
      'wrongPrefix_test': 'shouldNotBeRemoved',
    };

    render(<ClearLocalStorageButton />);
    
    const button = screen.getByRole('button', { name: 'Clear Test Data' });
    fireEvent.click(button);

    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('testFixProgress_test');
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('wrongPrefix_test');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(1);
  });
});