import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../api';
import DashboardPage from './DashboardPage';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, getAlerts: vi.fn(), getFleetSummary: vi.fn() };
});

const summary: api.FleetSummary = { total: 6, available: 5, inService: 1 };
const alerts: api.AlertsResponse = {
  asOf: '2026-11-23',
  alerts: [
    { vehicleId: 4, rego: 'JKL012', make: 'Ford', model: 'Ranger', type: 'ServiceOverdue', message: 'Service is overdue', dueDate: '2026-11-08', daysRemaining: -15 },
    { vehicleId: 3, rego: 'GHI789', make: 'Hyundai', model: 'i30', type: 'RegoExpired', message: 'Rego has expired', dueDate: '2026-11-13', daysRemaining: -10 },
    { vehicleId: 5, rego: 'MNO345', make: 'Kia', model: 'Cerato', type: 'RegoExpiring', message: 'Rego expires soon', dueDate: '2026-12-13', daysRemaining: 20 },
    { vehicleId: 6, rego: 'PQR678', make: 'Subaru', model: 'Outback', type: 'LeaseEnding', message: 'Lease ends soon', dueDate: '2027-01-07', daysRemaining: 45 }
  ]
};

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

describe('DashboardPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows the fleet counts', async () => {
    vi.mocked(api.getFleetSummary).mockResolvedValue(summary);
    vi.mocked(api.getAlerts).mockResolvedValue(alerts);
    renderPage();

    const counts = within(await screen.findByLabelText('Fleet counts'));

    expect(counts.getByText('6')).toBeInTheDocument();
    expect(counts.getByText('5')).toBeInTheDocument();
    expect(counts.getByText('1')).toBeInTheDocument();
    expect(counts.getByText('Total vehicles')).toBeInTheDocument();
  });

  it('shows an alert card for every alert with the right label', async () => {
    vi.mocked(api.getFleetSummary).mockResolvedValue(summary);
    vi.mocked(api.getAlerts).mockResolvedValue(alerts);
    renderPage();

    expect(await screen.findByRole('link', { name: 'JKL012' })).toHaveAttribute('href', '/vehicles/4');
    expect(screen.getByText('Service overdue')).toBeInTheDocument();
    expect(screen.getByText('Rego expired')).toBeInTheDocument();
    expect(screen.getByText('Rego expiring soon')).toBeInTheDocument();
    expect(screen.getByText('Lease ending soon')).toBeInTheDocument();
    expect(screen.getByText('Ford Ranger')).toBeInTheDocument();
  });

  it('marks overdue and expired alerts as bad and the rest as warnings', async () => {
    vi.mocked(api.getFleetSummary).mockResolvedValue(summary);
    vi.mocked(api.getAlerts).mockResolvedValue(alerts);
    renderPage();
    await screen.findByText('Service overdue');

    expect(screen.getByText('Service overdue')).toHaveClass('bad');
    expect(screen.getByText('Rego expired')).toHaveClass('bad');
    expect(screen.getByText('Rego expiring soon')).toHaveClass('warn');
    expect(screen.getByText('Lease ending soon')).toHaveClass('warn');
  });

  it('shows a friendly message when there are no alerts', async () => {
    vi.mocked(api.getFleetSummary).mockResolvedValue(summary);
    vi.mocked(api.getAlerts).mockResolvedValue({ asOf: '2026-11-23', alerts: [] });
    renderPage();

    expect(await screen.findByText('No alerts. Everything is up to date.')).toBeInTheDocument();
  });

  it('shows an error when the dashboard cannot be loaded', async () => {
    vi.mocked(api.getFleetSummary).mockRejectedValue(new api.ApiError(403, 'You do not have permission to do that.'));
    vi.mocked(api.getAlerts).mockResolvedValue(alerts);
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to do that.');
    expect(screen.queryByLabelText('Fleet counts')).not.toBeInTheDocument();
  });

  it('shows a loading message while the data is on its way', () => {
    vi.mocked(api.getFleetSummary).mockReturnValue(new Promise<api.FleetSummary>(() => {}));
    vi.mocked(api.getAlerts).mockReturnValue(new Promise<api.AlertsResponse>(() => {}));
    renderPage();

    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });
});
