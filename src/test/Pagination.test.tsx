import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from '../components/shared/Pagination';

describe('Pagination', () => {
  it('should render nothing when there is only one page', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} totalItems={10} pageSize={50} onPageChange={vi.fn()} />
    );

    expect(container.innerHTML).toBe('');
  });

  it('should show the results summary and page count', () => {
    render(<Pagination currentPage={1} totalPages={3} totalItems={125} pageSize={50} onPageChange={vi.fn()} />);

    expect(screen.getByText(/Showing 1 to 50 of 125 results/)).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
  });

  it('should disable Previous on the first page and Next on the last page', () => {
    const { rerender } = render(
      <Pagination currentPage={1} totalPages={3} totalItems={125} pageSize={50} onPageChange={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled();

    rerender(<Pagination currentPage={3} totalPages={3} totalItems={125} pageSize={50} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('should call onPageChange with the adjacent page from Previous/Next', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination currentPage={2} totalPages={5} totalItems={250} pageSize={50} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('should call onPageChange when a page number is clicked', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={3} totalItems={125} pageSize={50} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: '2' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('should mark the current page number as the active page', () => {
    render(<Pagination currentPage={2} totalPages={3} totalItems={125} pageSize={50} onPageChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '1' })).not.toHaveAttribute('aria-current');
  });

  it('should show the first 5 pages when near the start of a long list', () => {
    render(<Pagination currentPage={1} totalPages={10} totalItems={500} pageSize={50} onPageChange={vi.fn()} />);

    ['1', '2', '3', '4', '5'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: '6' })).not.toBeInTheDocument();
  });

  it('should center the visible page window around the current page in the middle of a long list', () => {
    render(<Pagination currentPage={5} totalPages={10} totalItems={500} pageSize={50} onPageChange={vi.fn()} />);

    ['3', '4', '5', '6', '7'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '8' })).not.toBeInTheDocument();
  });

  it('should show the last 5 pages when near the end of a long list', () => {
    render(<Pagination currentPage={10} totalPages={10} totalItems={500} pageSize={50} onPageChange={vi.fn()} />);

    ['6', '7', '8', '9', '10'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument();
  });
});
