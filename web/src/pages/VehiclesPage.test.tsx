import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../api';
import VehiclesPage from './VehiclesPage';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, getVehicles: vi.fn() };
});

const dates = { regoExpiry: '2100-01-01', leaseEnd: '2100-01-01', nextServiceDue: '2100-01-01' };
const camry: api.Vehicle = { id: 1, rego: 'ABC123', make: 'Toyota', model: 'Camry', year: 2022, location: 'Sydney', status: 'Available', odometerKm: 24000, ...dates };
const cx5: api.Vehicle = { id: 2, rego: 'DEF456', make: 'Mazda', model: 'CX-5', year: 2021, location: 'Melbourne', status: 'InService', odometerKm: 41000, ...dates };
const ranger: api.Vehicle = { id: 3, rego: 'JKL012', make: 'Ford', model: 'Ranger', year: 2021, location: 'Sydney', status: 'Available', odometerKm: 38000, ...dates };
const fleet = [camry, cx5, ranger];

function renderPage() {
  return render(
    <MemoryRouter>
      <VehiclesPage />
    </MemoryRouter>
  );
}

describe('VehiclesPage', () => {
  beforeEach(() => {
    vi.mocked(api.getVehicles).mockResolvedValue(fleet);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows each vehicle with its make, model, year and location', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'ABC123' })).toBeInTheDocument();
    expect(screen.getByText('2022 Toyota Camry')).toBeInTheDocument();
    expect(screen.getByText('Sydney · 24,000 km')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'DEF456' })).toBeInTheDocument();
    expect(screen.getByText('2021 Mazda CX-5')).toBeInTheDocument();
    expect(screen.getByText('Melbourne · 41,000 km')).toBeInTheDocument();
  });

  it('says how many vehicles were found', async () => {
    renderPage();

    expect(await screen.findByText('3 vehicles')).toBeInTheDocument();
  });

  it('uses the singular for one vehicle', async () => {
    vi.mocked(api.getVehicles).mockResolvedValue([camry]);
    renderPage();

    expect(await screen.findByText('1 vehicle')).toBeInTheDocument();
  });

  it('links each vehicle to its details page', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'ABC123' })).toHaveAttribute('href', '/vehicles/1');
    expect(screen.getByRole('link', { name: 'DEF456' })).toHaveAttribute('href', '/vehicles/2');
  });

  it('shows a status badge on each vehicle', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'ABC123' });

    const list = within(screen.getByRole('list'));

    expect(list.getAllByText('Available')).toHaveLength(2);
    expect(list.getAllByText('In service')).toHaveLength(1);
  });

  it('shows a message when nothing matches', async () => {
    vi.mocked(api.getVehicles).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('No vehicles match your filters.')).toBeInTheDocument();
    expect(screen.getByText('0 vehicles')).toBeInTheDocument();
  });

  it('shows an error when the vehicles cannot be loaded', async () => {
    vi.mocked(api.getVehicles).mockRejectedValue(new api.ApiError(500, 'Request failed (500).'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500).');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows a loading message while the list is on its way', () => {
    vi.mocked(api.getVehicles).mockReturnValue(new Promise<api.Vehicle[]>(() => {}));
    renderPage();

    expect(screen.getByText('Loading vehicles...')).toBeInTheDocument();
  });

  it('offers every location in the fleet as a filter', async () => {
    renderPage();

    expect(await screen.findByRole('option', { name: 'Melbourne' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sydney' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All locations' })).toBeInTheDocument();
  });

  it('asks the API for the selected status', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'ABC123' });

    await userEvent.setup().selectOptions(screen.getByLabelText('Status'), 'InService');

    await waitFor(() =>
      expect(api.getVehicles).toHaveBeenLastCalledWith({ status: 'InService', location: '', search: '' })
    );
  });

  it('asks the API for the selected location', async () => {
    renderPage();
    await screen.findByRole('option', { name: 'Melbourne' });

    await userEvent.setup().selectOptions(screen.getByLabelText('Location'), 'Melbourne');

    await waitFor(() =>
      expect(api.getVehicles).toHaveBeenLastCalledWith({ status: '', location: 'Melbourne', search: '' })
    );
  });

  it('sends the search text once the user stops typing', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'ABC123' });

    await userEvent.setup().type(screen.getByLabelText('Search'), 'toy');

    await waitFor(() =>
      expect(api.getVehicles).toHaveBeenLastCalledWith({ status: '', location: '', search: 'toy' })
    );
    expect(api.getVehicles).not.toHaveBeenCalledWith({ status: '', location: '', search: 't' });
  });

  it('combines the filters', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('option', { name: 'Melbourne' });

    await user.selectOptions(screen.getByLabelText('Status'), 'Available');
    await user.selectOptions(screen.getByLabelText('Location'), 'Melbourne');

    await waitFor(() =>
      expect(api.getVehicles).toHaveBeenLastCalledWith({ status: 'Available', location: 'Melbourne', search: '' })
    );
  });

  it('clears every filter', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('option', { name: 'Melbourne' });
    const clear = screen.getByRole('button', { name: 'Clear filters' });
    expect(clear).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Status'), 'InService');
    await user.type(screen.getByLabelText('Search'), 'cx');
    expect(clear).toBeEnabled();
    await user.click(clear);

    expect(screen.getByLabelText('Status')).toHaveValue('');
    expect(screen.getByLabelText('Search')).toHaveValue('');
    expect(clear).toBeDisabled();
  });

  it('ignores an older response that arrives after a newer one', async () => {
    let finishFirst: (list: api.Vehicle[]) => void = () => {};
    vi.mocked(api.getVehicles).mockImplementation((filters) => {
      if (filters.status === 'InService') return Promise.resolve([cx5]);
      if (filters.status === '') return new Promise<api.Vehicle[]>((resolve) => (finishFirst = resolve));
      return Promise.resolve(fleet);
    });
    renderPage();
    await screen.findByRole('option', { name: 'Melbourne' });

    await userEvent.setup().selectOptions(screen.getByLabelText('Status'), 'InService');
    expect(await screen.findByRole('link', { name: 'DEF456' })).toBeInTheDocument();

    await act(async () => finishFirst(fleet));

    expect(screen.queryByRole('link', { name: 'ABC123' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'DEF456' })).toBeInTheDocument();
  });
});
