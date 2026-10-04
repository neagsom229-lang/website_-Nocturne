import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { PageState } from '../src/components/PageState';
import NotFound from '../src/routes/NotFound';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { ServerErrorPage } from '../src/components/ServerErrorPage';
import { OfflineBanner } from '../src/components/OfflineBanner';

afterEach(cleanup);

describe('Commit 6: States and Errors', () => {
  it('PageState renders correct loading, empty, and error variants', () => {
    const { rerender } = render(<PageState variant="loading" />);
    expect(screen.getByText('Making a little room…')).toBeTruthy();

    rerender(<PageState variant="empty" title="Empty shelf" body="Nothing here." />);
    expect(screen.getByText('Empty shelf')).toBeTruthy();
    expect(screen.getByText('Nothing here.')).toBeTruthy();

    const onRetry = vi.fn();
    rerender(<PageState variant="error" title="Failed" body="Error occurred." onRetry={onRetry} />);
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('Error occurred.')).toBeTruthy();
    
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('NotFound renders on unknown route', () => {
    render(
      <MemoryRouter initialEntries={['/unknown-route-123']}>
        <Routes>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('This room is empty.')).toBeTruthy();
    expect(screen.getByText(/We couldn't find that page/i)).toBeTruthy();
  });

  it('ErrorBoundary catches thrown error and renders ServerErrorPage', () => {
    const ThrowingComponent = () => {
      throw new Error('Test crash');
    };

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<ServerErrorPage />}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went quiet.')).toBeTruthy();
    expect(screen.getByText('The room lost its light. Try again in a moment.')).toBeTruthy();
    spy.mockRestore();
  });

  it('OfflineBanner toggles when navigator.onLine changes', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false, writable: true });
    render(<OfflineBanner />);
    expect(screen.getByText(/You're offline/i)).toBeTruthy();

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true, writable: true });
    fireEvent(window, new Event('online'));
    expect(screen.queryByText(/You're offline/i)).toBeNull();
  });
});
