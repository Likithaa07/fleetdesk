import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../api';
import BookCarPage from './BookCarPage';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, getVehicle: vi.fn(), createBooking: vi.fn() };
});

const vehicle: api.VehicleDetails = {
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
  bookings: [],
  services: []
};

const created: api.Booking = {
  id: 9,
  vehicleId: 1,
  rego: 'ABC123',
  driverName: 'Dan Driver',
  startDate: '2100-02-01',
  endDate: '2100-02-03',
  purpose: 'Client meeting',
  status: 'Active'
};

function renderPage(path = '/vehicles/1/book') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/vehicles/:id/book" element={<BookCarPage />} />
        <Route path="/vehicles" element={<p>Vehicles list</p>} />
        <Route path="/bookings" element={<p>Bookings page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

async function fill(start: string, end: string, purpose: string) {
  const user = userEvent.setup();
  if (start) await user.type(screen.getByLabelText('Start date'), start);
  if (end) await user.type(screen.getByLabelText('End date'), end);
  if (purpose) await user.type(screen.getByLabelText('Purpose'), purpose);
  await user.click(screen.getByRole('button', { name: 'Book this car' }));
}

describe('BookCarPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('loads the vehicle whose id is in the address', async () => {
    vi.mocked(api.getVehicle).mockResolvedValue(vehicle);
    renderPage();

    expect(await screen.findByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText('2022 Toyota Camry · Sydney')).toBeInTheDocument();
    expect(api.getVehicle).toHaveBeenCalledWith(1);
  });

  it('shows a loading message while the vehicle is on its way', () => {
    vi.mocked(api.getVehicle).mockReturnValue(new Promise<api.VehicleDetails>(() => {}));
    renderPage();

    expect(screen.getByText('Loading vehicle...')).toBeInTheDocument();
  });

  it('shows the API error when the vehicle cannot be loaded', async () => {
    vi.mocked(api.getVehicle).mockRejectedValue(new api.ApiError(404, 'Vehicle 999 not found.'));
    renderPage('/vehicles/999/book');

    expect(await screen.findByRole('alert')).toHaveTextContent('Vehicle 999 not found.');
    expect(screen.queryByRole('button', { name: 'Book this car' })).not.toBeInTheDocument();
  });

  it('shows a not found message for an address that is not a vehicle number', () => {
    renderPage('/vehicles/abc/book');

    expect(screen.getByRole('alert')).toHaveTextContent('That vehicle was not found.');
    expect(api.getVehicle).not.toHaveBeenCalled();
  });

  it('shows every validation message and does not call the API for an empty form', async () => {
    vi.mocked(api.getVehicle).mockResolvedValue(vehicle);
    renderPage();
    await screen.findByText('ABC123');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Book this car' }));

    expect(screen.getByText('Choose a start date.')).toBeInTheDocument();
    expect(screen.getByText('Choose an end date.')).toBeInTheDocument();
    expect(screen.getByText('Enter the purpose of the trip.')).toBeInTheDocument();
    expect(api.createBooking).not.toHaveBeenCalled();
  });

  it('rejects an end date before the start date', async () => {
    vi.mocked(api.getVehicle).mockResolvedValue(vehicle);
    renderPage();
    await screen.findByText('ABC123');

    await fill('2100-02-05', '2100-02-01', 'Trip');

    expect(screen.getByText('The end date cannot be before the start date.')).toBeInTheDocument();
    expect(api.createBooking).not.toHaveBeenCalled();
  });

  it('rejects a start date in the past', async () => {
    vi.mocked(api.getVehicle).mockResolvedValue(vehicle);
    renderPage();
    await screen.findByText('ABC123');

    await fill('2000-01-01', '2000-01-03', 'Trip');

    expect(screen.getByText('The start date cannot be in the past.')).toBeInTheDocument();
    expect(api.createBooking).not.toHaveBeenCalled();
  });

  it('sends a trimmed booking and goes to the bookings page', async () => {
    vi.mocked(api.getVehicle).mockResolvedValue(vehicle);
    vi.mocked(api.createBooking).mockResolvedValue(created);
    renderPage();
    await screen.findByText('ABC123');

    await fill('2100-02-01', '2100-02-03', '  Client meeting  ');

    expect(await screen.findByText('Bookings page')).toBeInTheDocument();
    expect(api.createBooking).toHaveBeenCalledWith({
      vehicleId: 1,
      startDate: '2100-02-01',
      endDate: '2100-02-03',
      purpose: 'Client meeting'
    });
  });

  it('shows the server message when the booking is refused', async () => {
    vi.mocked(api.getVehicle).mockResolvedValue(vehicle);
    vi.mocked(api.createBooking).mockRejectedValue(
      new api.ApiError(409, 'This vehicle is already booked for those dates.')
    );
    renderPage();
    await screen.findByText('ABC123');

    await fill('2100-02-01', '2100-02-03', 'Trip');

    expect(await screen.findByRole('alert')).toHaveTextContent('This vehicle is already booked for those dates.');
    expect(screen.queryByText('Bookings page')).not.toBeInTheDocument();
  });

  it('shows a generic message for an unexpected error', async () => {
    vi.mocked(api.getVehicle).mockResolvedValue(vehicle);
    vi.mocked(api.createBooking).mockRejectedValue(new Error('boom'));
    renderPage();
    await screen.findByText('ABC123');

    await fill('2100-02-01', '2100-02-03', 'Trip');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('disables the button while booking', async () => {
    vi.mocked(api.getVehicle).mockResolvedValue(vehicle);
    vi.mocked(api.createBooking).mockReturnValue(new Promise<api.Booking>(() => {}));
    renderPage();
    await screen.findByText('ABC123');

    await fill('2100-02-01', '2100-02-03', 'Trip');

    expect(screen.getByRole('button', { name: 'Booking...' })).toBeDisabled();
  });
});
