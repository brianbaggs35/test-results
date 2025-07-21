import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterControls } from '../components/Dashboard/FilterControls';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  SearchIcon: () => <div data-testid="search-icon" />,
  FilterIcon: () => <div data-testid="filter-icon" />,
  ChevronDownIcon: () => <div data-testid="chevron-down-icon" />,
  ChevronUpIcon: () => <div data-testid="chevron-up-icon" />,
  XCircleIcon: () => <div data-testid="x-circle-icon" />
}));

describe('FilterControls', () => {
  const defaultProps = {
    searchTerm: '',
    setSearchTerm: vi.fn(),
    statusFilter: 'all',
    setStatusFilter: vi.fn(),
    suiteFilter: 'all',
    setSuiteFilter: vi.fn(),
    classNameFilter: 'all',
    setClassNameFilter: vi.fn(),
    showFilters: false,
    setShowFilters: vi.fn(),
    suites: ['Suite 1', 'Suite 2'],
    classNames: ['Class A', 'Class B'],
    resetFilters: vi.fn(),
    statusOptions: [
      { value: 'all', label: 'All Status' },
      { value: 'passed', label: 'Passed' },
      { value: 'failed', label: 'Failed' },
      { value: 'skipped', label: 'Skipped' }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render search input', () => {
    render(<FilterControls {...defaultProps} />);

    expect(screen.getByPlaceholderText('Search tests...')).toBeInTheDocument();
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
  });

  it('should render filter button', () => {
    render(<FilterControls {...defaultProps} />);

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByTestId('filter-icon')).toBeInTheDocument();
    expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument();
  });

  it('should call setSearchTerm when search input changes', async () => {
    const user = userEvent.setup();
    render(<FilterControls {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search tests...');
    await user.type(searchInput, 'test query');

    expect(defaultProps.setSearchTerm).toHaveBeenCalledWith('test query');
  });

  it('should display search term value', () => {
    render(<FilterControls {...defaultProps} searchTerm="existing search" />);

    expect(screen.getByDisplayValue('existing search')).toBeInTheDocument();
  });

  it('should call setShowFilters when filters button is clicked', async () => {
    const user = userEvent.setup();
    render(<FilterControls {...defaultProps} />);

    const filtersButton = screen.getByText('Filters');
    await user.click(filtersButton);

    expect(defaultProps.setShowFilters).toHaveBeenCalledWith(true);
  });

  it('should show chevron up icon when filters are shown', () => {
    render(<FilterControls {...defaultProps} showFilters={true} />);

    expect(screen.getByTestId('chevron-up-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('chevron-down-icon')).not.toBeInTheDocument();
  });

  it('should show clear filters button when filters are active', () => {
    render(<FilterControls {...defaultProps} statusFilter="failed" />);

    expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    expect(screen.getByTestId('x-circle-icon')).toBeInTheDocument();
  });

  it('should call resetFilters when clear filters button is clicked', async () => {
    const user = userEvent.setup();
    render(<FilterControls {...defaultProps} statusFilter="failed" />);

    const clearButton = screen.getByText('Clear Filters');
    await user.click(clearButton);

    expect(defaultProps.resetFilters).toHaveBeenCalled();
  });

  it('should show filter dropdowns when showFilters is true', () => {
    render(<FilterControls {...defaultProps} showFilters={true} />);

    // Check for status filter
    expect(screen.getByDisplayValue('All Status')).toBeInTheDocument();
    
    // Check for suite filter
    expect(screen.getByDisplayValue('All Suites')).toBeInTheDocument();
    
    // Check for class name filter
    expect(screen.getByDisplayValue('All Classes')).toBeInTheDocument();
  });

  it('should render suite options in dropdown', () => {
    render(<FilterControls {...defaultProps} showFilters={true} />);

    const suiteSelect = screen.getByDisplayValue('All Suites');
    expect(suiteSelect).toBeInTheDocument();
  });

  it('should render class name options in dropdown', () => {
    render(<FilterControls {...defaultProps} showFilters={true} />);

    const classSelect = screen.getByDisplayValue('All Classes');
    expect(classSelect).toBeInTheDocument();
  });

  it('should call setStatusFilter when status dropdown changes', () => {
    render(<FilterControls {...defaultProps} showFilters={true} />);

    const statusSelect = screen.getByDisplayValue('All Status');
    fireEvent.change(statusSelect, { target: { value: 'failed' } });

    expect(defaultProps.setStatusFilter).toHaveBeenCalledWith('failed');
  });

  it('should call setSuiteFilter when suite dropdown changes', () => {
    render(<FilterControls {...defaultProps} showFilters={true} />);

    const suiteSelect = screen.getByDisplayValue('All Suites');
    fireEvent.change(suiteSelect, { target: { value: 'Suite 1' } });

    expect(defaultProps.setSuiteFilter).toHaveBeenCalledWith('Suite 1');
  });

  it('should call setClassNameFilter when class dropdown changes', () => {
    render(<FilterControls {...defaultProps} showFilters={true} />);

    const classSelect = screen.getByDisplayValue('All Classes');
    fireEvent.change(classSelect, { target: { value: 'Class A' } });

    expect(defaultProps.setClassNameFilter).toHaveBeenCalledWith('Class A');
  });

  it('should show active filters correctly', () => {
    render(<FilterControls 
      {...defaultProps} 
      searchTerm="test" 
      statusFilter="failed"
      suiteFilter="Suite 1"
      classNameFilter="Class A"
    />);

    expect(screen.getByText('Clear Filters')).toBeInTheDocument();
  });

  it('should hide clear filters button when no filters are active', () => {
    render(<FilterControls {...defaultProps} />);

    expect(screen.queryByText('Clear Filters')).not.toBeInTheDocument();
  });

  it('should use default status options when not provided', () => {
    const propsWithoutStatusOptions = { ...defaultProps };
    delete (propsWithoutStatusOptions as any).statusOptions;
    
    render(<FilterControls {...propsWithoutStatusOptions} showFilters={true} />);

    // Should still render the status dropdown with default options
    expect(screen.getByDisplayValue('All Status')).toBeInTheDocument();
  });

  it('should display selected filter values correctly', () => {
    render(<FilterControls 
      {...defaultProps} 
      showFilters={true}
      statusFilter="failed"
      suiteFilter="Suite 1"
      classNameFilter="Class A"
    />);

    expect(screen.getByDisplayValue('Failed')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Suite 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Class A')).toBeInTheDocument();
  });
});