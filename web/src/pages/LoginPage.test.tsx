import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth';
import * as api from '../api';
import LoginPage from './LoginPage';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, login: vi.fn() };
});

const session: api.Session = {
  token: 'abc123',
  userId: 1,
  name: 'Maria Manager',
  email: 'manager@fleetdesk.test',
  role: 'Manager'
};

function renderLogin(entry: string | { pathname: string; state: unknown } = '/login') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>Home page</p>} />
          <Route path="/vehicles" element={<p>Vehicles page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('LoginPage', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('shows the email and password fields and a sign in button', () => {
    renderLogin();

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows both validation messages and does not call the API for an empty form', async () => {
    renderLogin();

    await fillAndSubmit('', '');

    expect(screen.getByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(api.login).not.toHaveBeenCalled();
  });

  it('rejects an email that is not valid', async () => {
    renderLogin();

    await fillAndSubmit('not-an-email', 'secret');

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(api.login).not.toHaveBeenCalled();
  });

  it('shows the server message when the login fails', async () => {
    vi.mocked(api.login).mockRejectedValue(new api.ApiError(401, 'Invalid email or password.'));
    renderLogin();

    await fillAndSubmit('manager@fleetdesk.test', 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
  });

  it('shows a generic message for an unexpected error', async () => {
    vi.mocked(api.login).mockRejectedValue(new Error('boom'));
    renderLogin();

    await fillAndSubmit('manager@fleetdesk.test', 'secret');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('signs in with a trimmed email and goes to the home page', async () => {
    vi.mocked(api.login).mockResolvedValue(session);
    renderLogin();

    await fillAndSubmit('  manager@fleetdesk.test  ', 'Password123!');

    expect(await screen.findByText('Home page')).toBeInTheDocument();
    expect(api.login).toHaveBeenCalledWith('manager@fleetdesk.test', 'Password123!');
  });

  it('returns to the page the user was sent from', async () => {
    vi.mocked(api.login).mockResolvedValue(session);
    renderLogin({ pathname: '/login', state: { from: '/vehicles' } });

    await fillAndSubmit('manager@fleetdesk.test', 'Password123!');

    expect(await screen.findByText('Vehicles page')).toBeInTheDocument();
  });

  it('disables the button while signing in', async () => {
    let finish: (s: api.Session) => void = () => {};
    vi.mocked(api.login).mockReturnValue(new Promise<api.Session>((resolve) => (finish = resolve)));
    renderLogin();

    await fillAndSubmit('manager@fleetdesk.test', 'secret');

    const button = screen.getByRole('button', { name: 'Signing in...' });
    expect(button).toBeDisabled();

    await act(async () => finish(session));
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });

  it('skips the form when already signed in', () => {
    api.saveSession(session);

    renderLogin();

    expect(screen.getByText('Home page')).toBeInTheDocument();
  });
});
