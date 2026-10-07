import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';

function TestConsumer() {
  const { user, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user === null ? 'null' : user === undefined ? 'undefined' : JSON.stringify(user)}</span>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AuthProvider StrictMode and loading', () => {
  it('handles 401 response in StrictMode and sets loading false and user null', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <StrictMode>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </StrictMode>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('user').textContent).toBe('null');
    });

    expect(fetchMock).toHaveBeenCalled();
  });
});
