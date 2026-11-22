import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../api';
import { AuthProvider } from '../auth';
import VehicleDetailsPage from './VehicleDetailsPage';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, getVehicle: vi.fn() };
});

const details: api.VehicleDetails = {
  id: 1,
  rego: 'ABC123',
  make: 'Toyota',
  model: 'Camry',
  year: 2022,
  location: 'Sydney',
  status: 'Available',
  odometerKm: 24000,
  regoExpiry: '2100-01-01',
  leaseEnd: '2100-06-30',
  nextServiceDue: '2100-03-15',
  bookings: [
    { id: 10, startDate: '2026-12-10', endDate: '2026-12-12', purpose: 'Client meeting', status: 'Active', driverName: 'Dan Driver' },
    { id: 11, startDate: '2026-10-01', endDate: '2026-10-03', purpose: 'Site visit', status: 'Cancelled', driverName: 'Priya Driver' }
  ],
  services: [{ id: 5, date: '2026-09-01', odometerKm: 23000, type: 'Brakes', cost: 250, notes: 'Front pads' }]
};

const manager: api.Session = { token: 't', userId: 1, name: 'Maria Manager', email: 'manager@fleetdesk.test', role: 'Manager' };
const driver: api.Session = { token: 't', userId: 3, name: 'Dan Driver', email: 'driver1@fleetdesk.test', role: 'Driver' };

function renderPage(path = '/vehicles/1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/vehicles/:id" element={<VehicleDetailsPage />} />
          <Route path="/vehicles" element={<p>Vehicles list</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('VehicleDetailsPage', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.resetAllMocks();
  });

  it('loads the vehicle whose id is in the address', async () => {
    vi.mocked(api.getVehicle).mockResolvedValue(details);
    renderPage('/vehicles/1');

    await screen.findByRole('heading', { name: 'ABC123' });

    expect(api.getVehicle).toHaveBeenCalledWith(1);
  });

  it('shows the vehicle and its details', async () => {
    vi.mocked(api.getVehicle).mockResolvedValue(details);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'ABC123' })).toBeInTheDocument();
    expect(screen.getByText('2022 Toyota Camry')).toBeInTheDocument();
    expect(screen.getByText('Sydney')).toBeInTheDocument();
    expect(screen.getByText('24,000 km')).toBeInTheDocument();
    expect(screen.getByText('1 Jan 2100')).toBeInTheDocument();
    expect(screen.getByText('15 Mar 2100')).toBeInTheDocument();
    expect(screen.getByText('30 Jun 2100')).toBeInTheDocument();
  });

  it('lists the booking history', async () => {
    vi.mocked(api.getVehicle).mockResolvedValue(details);
    renderPage();

    const table = within(await screen.findByRole('table', { name: 'Booking history' }));

    expect(table.getByText('10 Dec 2026 to 12 Dec 2026')).toBeInTheDocument();
    expect(table.getByText('Dan Driver')).toBeInTheDocument();
    expect(table.getByText('Client meeting')).toBeInTheDocument();
    expect(table.getByText('Active')).toBeInTheDocument();
    expect(table.getByText('Priya Driver')).toBeInTheDocument();
    expect(table.getByText('Cancelled')).toBeInTheDocument();
  });

  it('lists the service history', async () => {
    vi.mocked(api.getVehicle).mockResolvedValue(details);
    renderPage();

    const table = within(await screen.findByRole('table', { name: 'Service history' }));

    expect(table.getByText('1 Sep 2026')).toBeInTheDocument();
    expect(table.getByText('Brakes')).toBeInTheDocument();
    expect(table.getByText('23,000 km')).toBeInTheDocument();
    expect(table.getByText('$250.00')).toBeInTheDocument();
    expect(table.getByText('Front pads')).toBeInTheDocument();
  });

  it('shows friendly messages when there are no bookings or services', async () => {
    vi.mocked(api.getVehicle).mockResolvedValue({ ...details, bookings: [], services: [] });
    renderPage();
    await screen.findByRole('heading', { name: 'ABC123' });

    expect(screen.getByText('No bookings yet.')).toBeInTheDocument();
    expect(screen.getByText('No services recorded.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('tells a driver they only see their own bookings', async () => {
    api.saveSession(driver);
    vi.mocked(api.getVehicle).mockResolvedValue(details);
    renderPage();
    await screen.findByRole('heading', { name: 'ABC123' });

    expect(screen.getByText('You can only see your own bookings.')).toBeInTheDocument();
  });

  it('does not show that note to a manager', async () => {
    api.saveSession(manager);
    vi.mocked(api.getVehicle).mockResolvedValue(details);
    renderPage();
    await screen.findByRole('heading', { name: 'ABC123' });

    expect(screen.queryByText('You can only see your own bookings.')).not.toBeInTheDocument();
  });

  it('shows the API error and a way back when the vehicle cannot be loaded', async () => {
    vi.mocked(api.getVehicle).mockRejectedValue(new api.ApiError(404, 'Vehicle 999 not found.'));
    renderPage('/vehicles/999');

    expect(await screen.findByRole('alert')).toHaveTextContent('Vehicle 999 not found.');
    expect(screen.getByRole('link', { name: /all vehicles/i })).toBeInTheDocument();
  });

  it('shows a not found message for an address that is not a vehicle number', () => {
    renderPage('/vehicles/abc');

    expect(screen.getByRole('alert')).toHaveTextContent('That vehicle was not found.');
    expect(api.getVehicle).not.toHaveBeenCalled();
  });

  it('goes back to the vehicle list from the back link', async () => {
    vi.mocked(api.getVehicle).mockResolvedValue(details);
    renderPage();
    await screen.findByRole('heading', { name: 'ABC123' });

    await userEvent.setup().click(screen.getByRole('link', { name: /all vehicles/i }));

    expect(screen.getByText('Vehicles list')).toBeInTheDocument();
  });

  it('shows a loading message while the vehicle is on its way', () => {
    vi.mocked(api.getVehicle).mockReturnValue(new Promise<api.VehicleDetails>(() => {}));
    renderPage();

    expect(screen.getByText('Loading vehicle...')).toBeInTheDocument();
  });

  it('flags an expired rego and an overdue service', async () => {
    vi.mocked(api.getVehicle).mockResolvedValue({ ...details, regoExpiry: '2000-01-01', nextServiceDue: '2000-01-01' });
    renderPage();
    await screen.findByRole('heading', { name: 'ABC123' });

    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('shows no warnings when everything is far in the future', async () => {
    vi.mocked(api.getVehicle).mockResolvedValue(details);
    renderPage();
    await screen.findByRole('heading', { name: 'ABC123' });

    expect(screen.queryByText('Expired')).not.toBeInTheDocument();
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    expect(screen.queryByText(/Expires/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ends in/)).not.toBeInTheDocument();
  });
});
