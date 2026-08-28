import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('should render the title and description', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete item"
        description="This cannot be undone."
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText('Delete item')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('should default to "Confirm"/"Cancel" labels and the default button variant', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Title"
        description="Description"
        onConfirm={vi.fn()}
      />
    );

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(confirmButton).not.toHaveClass('from-destructive');
  });

  it('should use the destructive button styling when variant is "destructive"', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Title"
        description="Description"
        onConfirm={vi.fn()}
        variant="destructive"
      />
    );

    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveClass('from-destructive');
  });

  it('should render custom confirm/cancel labels when provided', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Title"
        description="Description"
        onConfirm={vi.fn()}
        confirmLabel="Yes, delete"
        cancelLabel="No, keep it"
      />
    );

    expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No, keep it' })).toBeInTheDocument();
  });

  it('should call onConfirm and then close the dialog when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Title"
        description="Description"
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should close the dialog without calling onConfirm when Cancel is clicked', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Title"
        description="Description"
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should render nothing when open is false', () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        title="Title"
        description="Description"
        onConfirm={vi.fn()}
      />
    );

    expect(screen.queryByText('Title')).not.toBeInTheDocument();
  });
});
