import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';

const session: api.Session = {
  token: 'abc123',
  userId: 1,
  name: 'Maria Manager',
  email: 'manager@fleetdesk.test',
  role: 'Manager'
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('api client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    api.setUnauthorizedHandler(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the login token as a bearer header', async () => {
    api.saveSession(session);
    fetchMock.mockResolvedValue(json([]));

    await api.getVehicles({});

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc123');
  });

  it('sends no auth header when signed out', async () => {
    fetchMock.mockResolvedValue(json([]));

    await api.getVehicles({});

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('builds the vehicle query string and skips blank filters', async () => {
    fetchMock.mockResolvedValue(json([]));

    await api.getVehicles({ status: 'Available', location: '', search: 'toy ota' });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/vehicles?status=Available&search=toy+ota');
  });

  it('uses the message from a server error body', async () => {
    fetchMock.mockResolvedValue(json({ message: 'This vehicle is in service and cannot be booked.' }, 409));

    await expect(
      api.createBooking({ vehicleId: 2, startDate: '2026-12-01', endDate: '2026-12-03', purpose: 'Trip' })
    ).rejects.toMatchObject({ status: 409, message: 'This vehicle is in service and cannot be booked.' });
  });

  it('uses the first validation error from a problem details body', async () => {
    fetchMock.mockResolvedValue(
      json(
        { title: 'One or more validation errors occurred.', errors: { Purpose: ['The Purpose field is required.'] } },
        400
      )
    );

    await expect(
      api.createBooking({ vehicleId: 1, startDate: '2026-12-01', endDate: '2026-12-03', purpose: '' })
    ).rejects.toMatchObject({ status: 400, message: 'The Purpose field is required.' });
  });

  it('gives a friendly message for a 403 with no body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));

    await expect(api.getAlerts()).rejects.toMatchObject({
      status: 403,
      message: 'You do not have permission to do that.'
    });
  });

  it('returns undefined for a 204 and sends DELETE', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(api.cancelBooking(5)).resolves.toBeUndefined();

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('DELETE');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/bookings/5');
  });

  it('reports a network failure as status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(api.getAlerts()).rejects.toMatchObject({
      status: 0,
      message: 'Could not reach the server. Please try again.'
    });
  });

  it('calls the unauthorized handler on a 401 while signed in', async () => {
    const handler = vi.fn();
    api.setUnauthorizedHandler(handler);
    api.saveSession(session);
    fetchMock.mockResolvedValue(json({}, 401));

    await expect(api.getAlerts()).rejects.toMatchObject({ status: 401 });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not call the unauthorized handler for a failed login', async () => {
    const handler = vi.fn();
    api.setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(json({ message: 'Invalid email or password.' }, 401));

    await expect(api.login('a@b.co', 'wrong')).rejects.toMatchObject({ message: 'Invalid email or password.' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('treats an unreadable saved session as signed out', () => {
    sessionStorage.setItem('fleetdesk.session', '{not json');

    expect(api.loadSession()).toBeNull();
  });

  it('sends the body as JSON on a post', async () => {
    fetchMock.mockResolvedValue(json(session));

    await api.login('a@b.co', 'pw');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ email: 'a@b.co', password: 'pw' }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });
});
