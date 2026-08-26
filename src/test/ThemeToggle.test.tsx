import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../components/theme/ThemeToggle';
import { ThemeProvider } from '../components/theme/ThemeProvider';

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('light', 'dark');
    localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.classList.remove('light', 'dark');
  });

  it('should render a single toggle button', () => {
    render(
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>
    );

    expect(screen.getByRole('button', { name: 'Toggle dark mode' })).toBeInTheDocument();
  });

  it('should switch the document to dark mode when toggled from light', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>
    );

    await waitFor(() => expect(document.documentElement.classList.contains('light')).toBe(true));

    await user.click(screen.getByRole('button', { name: 'Toggle dark mode' }));

    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
  });

  it('should switch back to light mode when toggled again', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider defaultTheme="dark" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>
    );

    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));

    await user.click(screen.getByRole('button', { name: 'Toggle dark mode' }));

    await waitFor(() => expect(document.documentElement.classList.contains('light')).toBe(true));
  });
});
