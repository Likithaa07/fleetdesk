import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../api';
import { AuthProvider } from '../auth';
import BookingsPage from './BookingsPage';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, getBookings: vi.fn(), cancelBooking: vi.fn() };
});

const active: api.Booking = {
  id: 1,
  vehicleId: 1,
  rego: 'ABC123',
  driverName: 'Dan Driver',
  startDate: '2026-12-10',
  endDate: '2026-12-12',
  purpose: 'Client meeting',
  status: 'Active'
};
const cancelled: api.Booking = {
  id: 2,
  vehicleId: 2,
  rego: 'DEF456',
  driverName: 'Priya Driver',
  startDate: '2026-10-01',
  endDate: '2026-10-03',
  purpose: 'Site visit',
  status: 'Cancelled'
};

const manager: api.Session = { token: 't', userId: 1, name: 'Maria Manager', email: 'manager@fleetdesk.test', role: 'Manager' };
const driver: api.Session = { token: 't', userId: 3, name: 'Dan Driver', email: 'driver1@fleetdesk.test', role: 'Driver' };

function renderPage(entry: string | { pathname: string; state: unknown } = '/bookings') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <BookingsPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('BookingsPage', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.resetAllMocks();
  });

  it('shows a driver the My bookings heading and no driver column', async () => {
    api.saveSession(driver);
    vi.mocked(api.getBookings).mockResolvedValue([active]);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'My bookings' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Driver' })).not.toBeInTheDocument();
  });

  it('shows a manager the All bookings heading and a driver column', async () => {
    api.saveSession(manager);
    vi.mocked(api.getBookings).mockResolvedValue([active]);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'All bookings' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Driver' })).toBeInTheDocument();
    expect(screen.getByText('Dan Driver')).toBeInTheDocument();
  });

  it('lists each booking with its dates, purpose and status', async () => {
    api.saveSession(driver);
    vi.mocked(api.getBookings).mockResolvedValue([active, cancelled]);
    renderPage();

    const table = within(await screen.findByRole('table', { name: 'Bookings' }));

    expect(table.getByRole('link', { name: 'ABC123' })).toHaveAttribute('href', '/vehicles/1');
    expect(table.getByText('10 Dec 2026 to 12 Dec 2026')).toBeInTheDocument();
    expect(table.getByText('Client meeting')).toBeInTheDocument();
    expect(table.getByText('Active')).toBeInTheDocument();
    expect(table.getByText('Cancelled')).toBeInTheDocument();
  });

  it('offers Cancel only on active bookings', async () => {
    api.saveSession(driver);
    vi.mocked(api.getBookings).mockResolvedValue([active, cancelled]);
    renderPage();
    await screen.findByRole('table', { name: 'Bookings' });

    expect(screen.getByRole('button', { name: 'Cancel booking for ABC123' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel booking for DEF456' })).not.toBeInTheDocument();
  });

  it('shows a friendly message when there are no bookings', async () => {
    api.saveSession(driver);
    vi.mocked(api.getBookings).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('No bookings yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse vehicles' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an error when the bookings cannot be loaded', async () => {
    api.saveSession(driver);
    vi.mocked(api.getBookings).mockRejectedValue(new api.ApiError(500, 'Request failed (500).'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500).');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a loading message while the list is on its way', () => {
    api.saveSession(driver);
    vi.mocked(api.getBookings).mockReturnValue(new Promise<api.Booking[]>(() => {}));
    renderPage();

    expect(screen.getByText('Loading bookings...')).toBeInTheDocument();
  });

  it('shows a success message after a booking was made', async () => {
    api.saveSession(driver);
    vi.mocked(api.getBookings).mockResolvedValue([active]);
    renderPage({ pathname: '/bookings', state: { booked: 'ABC123' } });

    expect(await screen.findByRole('status')).toHaveTextContent('Booked ABC123.');
  });

  it('cancels a booking and marks it cancelled', async () => {
    api.saveSession(driver);
    vi.mocked(api.getBookings).mockResolvedValue([active]);
    vi.mocked(api.cancelBooking).mockResolvedValue(undefined);
    renderPage();

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Cancel booking for ABC123' }));

    expect(api.cancelBooking).toHaveBeenCalledWith(1);
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel booking for ABC123' })).not.toBeInTheDocument();
  });

  it('shows the server message when a cancel is refused', async () => {
    api.saveSession(driver);
    vi.mocked(api.getBookings).mockResolvedValue([active]);
    vi.mocked(api.cancelBooking).mockRejectedValue(new api.ApiError(409, 'That booking is already cancelled.'));
    renderPage();

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Cancel booking for ABC123' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That booking is already cancelled.');
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('disables the button while cancelling', async () => {
    api.saveSession(driver);
    vi.mocked(api.getBookings).mockResolvedValue([active]);
    let finish: () => void = () => {};
    vi.mocked(api.cancelBooking).mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    renderPage();

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Cancel booking for ABC123' }));

    expect(screen.getByRole('button', { name: 'Cancel booking for ABC123' })).toBeDisabled();

    await act(async () => finish());
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
  });
});
