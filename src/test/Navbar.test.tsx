import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navbar } from '../components/Layout/Navbar';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  BarChartIcon: () => <div data-testid="bar-chart-icon" />,
  FileTextIcon: () => <div data-testid="file-text-icon" />,
  AlertTriangleIcon: () => <div data-testid="alert-triangle-icon" />,
  ListChecksIcon: () => <div data-testid="list-checks-icon" />,
}));

describe('Navbar', () => {
  const mockSetActiveTab = vi.fn();

  beforeEach(() => {
    mockSetActiveTab.mockClear();
  });

  it('should render with the correct title', () => {
    render(<Navbar activeTab="dashboard" setActiveTab={mockSetActiveTab} />);
    
    expect(screen.getByText('Test Results Platform')).toBeInTheDocument();
  });

  it('should render all navigation tabs', () => {
    render(<Navbar activeTab="dashboard" setActiveTab={mockSetActiveTab} />);
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Failures')).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('Report')).toBeInTheDocument();
  });

  it('should render all icons', () => {
    render(<Navbar activeTab="dashboard" setActiveTab={mockSetActiveTab} />);
    
    expect(screen.getByTestId('bar-chart-icon')).toBeInTheDocument();
    expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
    expect(screen.getByTestId('list-checks-icon')).toBeInTheDocument();
    expect(screen.getByTestId('file-text-icon')).toBeInTheDocument();
  });

  it('should highlight the active dashboard tab', () => {
    render(<Navbar activeTab="dashboard" setActiveTab={mockSetActiveTab} />);
    
    const dashboardButton = screen.getByText('Dashboard').closest('button');
    expect(dashboardButton).toHaveClass('bg-blue-100 text-blue-700');
  });

  it('should highlight the active failures tab', () => {
    render(<Navbar activeTab="failures" setActiveTab={mockSetActiveTab} />);
    
    const failuresButton = screen.getByText('Failures').closest('button');
    expect(failuresButton).toHaveClass('bg-red-100 text-red-700');
  });

  it('should highlight the active progress tab', () => {
    render(<Navbar activeTab="progress" setActiveTab={mockSetActiveTab} />);
    
    const progressButton = screen.getByText('Progress').closest('button');
    expect(progressButton).toHaveClass('bg-purple-100 text-purple-700');
  });

  it('should highlight the active report tab', () => {
    render(<Navbar activeTab="report" setActiveTab={mockSetActiveTab} />);
    
    const reportButton = screen.getByText('Report').closest('button');
    expect(reportButton).toHaveClass('bg-blue-100 text-blue-700');
  });

  it('should call setActiveTab when dashboard button is clicked', () => {
    render(<Navbar activeTab="failures" setActiveTab={mockSetActiveTab} />);
    
    fireEvent.click(screen.getByText('Dashboard'));
    
    expect(mockSetActiveTab).toHaveBeenCalledWith('dashboard');
    expect(mockSetActiveTab).toHaveBeenCalledTimes(1);
  });

  it('should call setActiveTab when failures button is clicked', () => {
    render(<Navbar activeTab="dashboard" setActiveTab={mockSetActiveTab} />);
    
    fireEvent.click(screen.getByText('Failures'));
    
    expect(mockSetActiveTab).toHaveBeenCalledWith('failures');
  });

  it('should call setActiveTab when progress button is clicked', () => {
    render(<Navbar activeTab="dashboard" setActiveTab={mockSetActiveTab} />);
    
    fireEvent.click(screen.getByText('Progress'));
    
    expect(mockSetActiveTab).toHaveBeenCalledWith('progress');
  });

  it('should call setActiveTab when report button is clicked', () => {
    render(<Navbar activeTab="dashboard" setActiveTab={mockSetActiveTab} />);
    
    fireEvent.click(screen.getByText('Report'));
    
    expect(mockSetActiveTab).toHaveBeenCalledWith('report');
  });

  it('should apply default styling to inactive tabs', () => {
    render(<Navbar activeTab="dashboard" setActiveTab={mockSetActiveTab} />);
    
    const failuresButton = screen.getByText('Failures').closest('button');
    const progressButton = screen.getByText('Progress').closest('button');
    const reportButton = screen.getByText('Report').closest('button');
    
    expect(failuresButton).toHaveClass('text-gray-600 hover:bg-gray-100');
    expect(progressButton).toHaveClass('text-gray-600 hover:bg-gray-100');
    expect(reportButton).toHaveClass('text-gray-600 hover:bg-gray-100');
  });

  it('should handle unknown active tab gracefully', () => {
    render(<Navbar activeTab="unknown" setActiveTab={mockSetActiveTab} />);
    
    // All tabs should be inactive
    const dashboardButton = screen.getByText('Dashboard').closest('button');
    const failuresButton = screen.getByText('Failures').closest('button');
    
    expect(dashboardButton).toHaveClass('text-gray-600 hover:bg-gray-100');
    expect(failuresButton).toHaveClass('text-gray-600 hover:bg-gray-100');
  });
});