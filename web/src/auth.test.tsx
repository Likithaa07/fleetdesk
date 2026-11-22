import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './auth';
import * as api from './api';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, login: vi.fn() };
});

const session: api.Session = {
  token: 'abc123',
  userId: 1,
  name: 'Maria Manager',
  email: 'manager@fleetdesk.test',
  role: 'Manager'
};

function Probe() {
  const { session: current, login, logout } = useAuth();
  return (
    <div>
      <p>{current ? `signed in as ${current.name}` : 'signed out'}</p>
      <button onClick={() => login('a@b.co', 'pw')}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

describe('AuthProvider', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts signed out', () => {
    renderProbe();

    expect(screen.getByText('signed out')).toBeInTheDocument();
  });

  it('starts signed in when a session was saved', () => {
    api.saveSession(session);

    renderProbe();

    expect(screen.getByText('signed in as Maria Manager')).toBeInTheDocument();
  });

  it('login saves the session and shows the user', async () => {
    vi.mocked(api.login).mockResolvedValue(session);
    renderProbe();

    await userEvent.setup().click(screen.getByText('login'));

    expect(await screen.findByText('signed in as Maria Manager')).toBeInTheDocument();
    expect(api.loadSession()).toEqual(session);
  });

  it('logout clears the session', async () => {
    api.saveSession(session);
    renderProbe();

    await userEvent.setup().click(screen.getByText('logout'));

    expect(screen.getByText('signed out')).toBeInTheDocument();
    expect(api.loadSession()).toBeNull();
  });

  it('useAuth throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow('useAuth must be used inside AuthProvider');

    spy.mockRestore();
  });

  it('signs the user out when the API rejects the token', async () => {
    api.saveSession(session);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    renderProbe();
    expect(screen.getByText('signed in as Maria Manager')).toBeInTheDocument();

    await act(async () => {
      await api.getAlerts().catch(() => undefined);
    });

    expect(screen.getByText('signed out')).toBeInTheDocument();
  });
});
