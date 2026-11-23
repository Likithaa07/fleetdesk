import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../api';
import { todayIso } from '../bookingValidation';
import LogServicePage from './LogServicePage';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, getVehicle: vi.fn(), logService: vi.fn() };
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

const saved: api.LogServiceResult = {
  service: { id: 9, date: '2026-11-20', odometerKm: 25000, type: 'Logbook service', cost: 400, notes: 'Oil' },
  nextServiceDue: '2027-05-20'
};

function renderPage(path = '/vehicles/1/service') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/vehicles/:id/service" element={<LogServicePage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function loaded() {
  vi.mocked(api.getVehicle).mockResolvedValue(vehicle);
  renderPage();
  await screen.findByText('ABC123');
}

async function fill(values: { date?: string; odometer?: string; type?: string; cost?: string; notes?: string }) {
  const user = userEvent.setup();
  if (values.date !== undefined) {
    fireEvent.change(screen.getByLabelText('Service date'), { target: { value: values.date } });
  }
  if (values.odometer) await user.type(screen.getByLabelText('Odometer (km)'), values.odometer);
  if (values.type) await user.type(screen.getByLabelText('Service type'), values.type);
  if (values.cost) await user.type(screen.getByLabelText('Cost ($)'), values.cost);
  if (values.notes) await user.type(screen.getByLabelText('Notes (optional)'), values.notes);
}

async function submit() {
  await userEvent.setup().click(screen.getByRole('button', { name: 'Log service' }));
}

describe('LogServicePage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('loads the vehicle from the address and shows its details', async () => {
    await loaded();

    expect(api.getVehicle).toHaveBeenCalledWith(1);
    expect(screen.getByText('2022 Toyota Camry · Next service due 15 Mar 2100')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Log a service' })).toBeInTheDocument();
  });

  it('shows a loading message while the vehicle is on its way', () => {
    vi.mocked(api.getVehicle).mockReturnValue(new Promise<api.VehicleDetails>(() => {}));
    renderPage();

    expect(screen.getByText('Loading vehicle...')).toBeInTheDocument();
  });

  it('shows a not found message for an address that is not a vehicle number', () => {
    renderPage('/vehicles/abc/service');

    expect(screen.getByRole('alert')).toHaveTextContent('That vehicle was not found.');
    expect(api.getVehicle).not.toHaveBeenCalled();
  });

  it('shows the API error and no form when the vehicle cannot be loaded', async () => {
    vi.mocked(api.getVehicle).mockRejectedValue(new api.ApiError(404, 'Vehicle 999 not found.'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Vehicle 999 not found.');
    expect(screen.queryByLabelText('Service date')).not.toBeInTheDocument();
  });

  it('links back to the vehicle', async () => {
    await loaded();

    expect(screen.getByRole('link', { name: /back to vehicle/i })).toHaveAttribute('href', '/vehicles/1');
  });

  it('starts with today as the service date', async () => {
    await loaded();

    expect(screen.getByLabelText('Service date')).toHaveValue(todayIso());
  });

  it('asks for the three missing fields and does not call the API for an empty form', async () => {
    await loaded();

    await submit();

    expect(screen.getByText('Enter the odometer reading in km.')).toBeInTheDocument();
    expect(screen.getByText('Enter the type of service.')).toBeInTheDocument();
    expect(screen.getByText('Enter the cost (0 or more).')).toBeInTheDocument();
    expect(screen.queryByText('Choose the service date.')).not.toBeInTheDocument();
    expect(api.logService).not.toHaveBeenCalled();
  });

  it('asks for the date when it has been cleared', async () => {
    await loaded();

    await fill({ date: '', odometer: '25000', type: 'Logbook service', cost: '400' });
    await submit();

    expect(screen.getByText('Choose the service date.')).toBeInTheDocument();
    expect(api.logService).not.toHaveBeenCalled();
  });

  it('rejects a negative odometer and a negative cost', async () => {
    await loaded();

    await fill({ type: 'Logbook service' });
    fireEvent.change(screen.getByLabelText('Odometer (km)'), { target: { value: '-5' } });
    fireEvent.change(screen.getByLabelText('Cost ($)'), { target: { value: '-1' } });
    await submit();

    expect(screen.getByText('Enter the odometer reading in km.')).toBeInTheDocument();
    expect(screen.getByText('Enter the cost (0 or more).')).toBeInTheDocument();
    expect(api.logService).not.toHaveBeenCalled();
  });

  it('rejects a service type that is only spaces', async () => {
    await loaded();

    await fill({ odometer: '25000', type: '   ', cost: '400' });
    await userEvent.setup().type(screen.getByLabelText('Service type'), '  ');
    await submit();

    expect(screen.getByText('Enter the type of service.')).toBeInTheDocument();
    expect(api.logService).not.toHaveBeenCalled();
  });

  it('sends the trimmed values to the API for the right vehicle', async () => {
    vi.mocked(api.logService).mockResolvedValue(saved);
    await loaded();

    await fill({ date: '2026-11-20', odometer: '25000', type: '  Logbook service  ', cost: '400', notes: '  Oil  ' });
    await submit();

    expect(api.logService).toHaveBeenCalledWith(1, {
      date: '2026-11-20',
      odometerKm: 25000,
      type: 'Logbook service',
      cost: 400,
      notes: 'Oil'
    });
  });

  it('leaves notes out when they are blank', async () => {
    vi.mocked(api.logService).mockResolvedValue(saved);
    await loaded();

    await fill({ date: '2026-11-20', odometer: '25000', type: 'Logbook service', cost: '400' });
    await submit();

    expect(api.logService).toHaveBeenCalledWith(1, {
      date: '2026-11-20',
      odometerKm: 25000,
      type: 'Logbook service',
      cost: 400,
      notes: undefined
    });
  });

  it('allows a service that cost nothing', async () => {
    vi.mocked(api.logService).mockResolvedValue(saved);
    await loaded();

    await fill({ date: '2026-11-20', odometer: '25000', type: 'Warranty check', cost: '0' });
    await submit();

    expect(api.logService).toHaveBeenCalledWith(1, expect.objectContaining({ cost: 0 }));
  });

  it('shows the new next service date and clears the form, keeping the date', async () => {
    vi.mocked(api.logService).mockResolvedValue(saved);
    await loaded();

    await fill({ date: '2026-11-20', odometer: '25000', type: 'Logbook service', cost: '400', notes: 'Oil' });
    await submit();

    expect(await screen.findByRole('status')).toHaveTextContent('Service logged. Next service due 20 May 2027.');
    expect(screen.getByLabelText('Odometer (km)')).toHaveValue(null);
    expect(screen.getByLabelText('Service type')).toHaveValue('');
    expect(screen.getByLabelText('Cost ($)')).toHaveValue(null);
    expect(screen.getByLabelText('Notes (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Service date')).toHaveValue('2026-11-20');
  });

  it('shows the server message and keeps what was typed when the API refuses', async () => {
    vi.mocked(api.logService).mockRejectedValue(new api.ApiError(400, "The service date can't be in the future."));
    await loaded();

    await fill({ date: '2026-11-20', odometer: '25000', type: 'Logbook service', cost: '400' });
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent("The service date can't be in the future.");
    expect(screen.getByLabelText('Odometer (km)')).toHaveValue(25000);
    expect(screen.getByLabelText('Service type')).toHaveValue('Logbook service');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a generic message for an unexpected error', async () => {
    vi.mocked(api.logService).mockRejectedValue(new Error('boom'));
    await loaded();

    await fill({ date: '2026-11-20', odometer: '25000', type: 'Logbook service', cost: '400' });
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('disables the button while saving', async () => {
    let finish: (r: api.LogServiceResult) => void = () => {};
    vi.mocked(api.logService).mockReturnValue(new Promise<api.LogServiceResult>((resolve) => (finish = resolve)));
    await loaded();

    await fill({ date: '2026-11-20', odometer: '25000', type: 'Logbook service', cost: '400' });
    await submit();

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();

    await act(async () => finish(saved));
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  it('removes the old success message when the next attempt has mistakes', async () => {
    vi.mocked(api.logService).mockResolvedValue(saved);
    await loaded();
    await fill({ date: '2026-11-20', odometer: '25000', type: 'Logbook service', cost: '400' });
    await submit();
    await screen.findByRole('status');

    await submit();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Enter the odometer reading in km.')).toBeInTheDocument();
  });
});
