import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { AuthProvider } from './auth';
import * as api from './api';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, getVehicles: vi.fn(), getVehicle: vi.fn() };
});

const manager: api.Session = { token: 't', userId: 1, name: 'Maria Manager', email: 'manager@fleetdesk.test', role: 'Manager' };
const driver: api.Session = { token: 't', userId: 3, name: 'Dan Driver', email: 'driver1@fleetdesk.test', role: 'Driver' };

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('App routing and navigation', () => {
  beforeEach(() => {
    vi.mocked(api.getVehicles).mockResolvedValue([]);
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.resetAllMocks();
  });

  it('sends a signed-out visitor to the login page', async () => {
    renderApp('/vehicles');

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(api.getVehicles).not.toHaveBeenCalled();
  });

  it('shows a manager the dashboard, vehicles and all bookings links', () => {
    api.saveSession(manager);
    renderApp('/');

    const nav = within(screen.getByRole('navigation', { name: 'Main' }));

    expect(nav.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Vehicles' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'All bookings' })).toBeInTheDocument();
  });

  it('shows a driver vehicles and my bookings, but no dashboard', () => {
    api.saveSession(driver);
    renderApp('/');

    const nav = within(screen.getByRole('navigation', { name: 'Main' }));

    expect(nav.getByRole('link', { name: 'Vehicles' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'My bookings' })).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('welcomes the signed-in user on the home page', () => {
    api.saveSession(manager);
    renderApp('/');

    expect(screen.getByRole('heading', { name: 'Welcome, Maria Manager' })).toBeInTheDocument();
  });

  it('shows the vehicles page at /vehicles', async () => {
    api.saveSession(manager);
    renderApp('/vehicles');

    expect(await screen.findByRole('heading', { name: 'Vehicles', level: 1 })).toBeInTheDocument();
    expect(api.getVehicles).toHaveBeenCalled();
  });

  it('opens the vehicle details page at /vehicles/1', () => {
    api.saveSession(manager);
    vi.mocked(api.getVehicle).mockReturnValue(new Promise<api.VehicleDetails>(() => {}));
    renderApp('/vehicles/1');

    expect(api.getVehicle).toHaveBeenCalledWith(1);
    expect(screen.getByText('Loading vehicle...')).toBeInTheDocument();
  });

  it('shows a not found page for an unknown address', () => {
    api.saveSession(manager);
    renderApp('/nowhere');

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('signs out and returns to the login page', async () => {
    api.saveSession(manager);
    renderApp('/');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(api.loadSession()).toBeNull();
  });
});
