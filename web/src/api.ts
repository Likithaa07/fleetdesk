// All calls to the FleetDesk API live here. In development the Vite proxy forwards /api to .NET.
// For a deployed site, set VITE_API_URL to the API's address.
const BASE: string = import.meta.env.VITE_API_URL ?? '';
const SESSION_KEY = 'fleetdesk.session';

export type Role = 'Manager' | 'Driver';

export interface Session {
  token: string;
  userId: number;
  name: string;
  email: string;
  role: Role;
}

export interface Vehicle {
  id: number;
  rego: string;
  make: string;
  model: string;
  year: number;
  location: string;
  status: 'Available' | 'InService';
  odometerKm: number;
  regoExpiry: string;
  leaseEnd: string;
  nextServiceDue: string;
}

export interface BookingHistory {
  id: number;
  startDate: string;
  endDate: string;
  purpose: string;
  status: 'Active' | 'Cancelled';
  driverName: string;
}

export interface ServiceHistory {
  id: number;
  date: string;
  odometerKm: number;
  type: string;
  cost: number;
  notes: string;
}

export interface VehicleDetails extends Vehicle {
  bookings: BookingHistory[];
  services: ServiceHistory[];
}

export interface Booking {
  id: number;
  vehicleId: number;
  rego: string;
  driverName: string;
  startDate: string;
  endDate: string;
  purpose: string;
  status: 'Active' | 'Cancelled';
}

export interface Alert {
  vehicleId: number;
  rego: string;
  make: string;
  model: string;
  type: 'ServiceOverdue' | 'RegoExpired' | 'RegoExpiring' | 'LeaseEnding';
  message: string;
  dueDate: string;
  daysRemaining: number;
}

export interface AlertsResponse {
  asOf: string;
  alerts: Alert[];
}

export interface FleetSummary {
  total: number;
  available: number;
  inService: number;
}

export interface VehicleRequest {
  rego: string;
  make: string;
  model: string;
  year: number;
  location: string;
  status: string;
  odometerKm: number;
  regoExpiry: string;
  leaseEnd: string;
  nextServiceDue: string;
}

export interface CreateBookingRequest {
  vehicleId: number;
  startDate: string;
  endDate: string;
  purpose: string;
}

export interface LogServiceRequest {
  date: string;
  odometerKm: number;
  type: string;
  cost: number;
  notes?: string;
}

export interface LogServiceResult {
  service: ServiceHistory;
  nextServiceDue: string;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ---- session (kept in sessionStorage, so it ends when the tab closes) ----

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  try {
    if (session) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Storage can be blocked by browser settings. The app still works until the page reloads.
  }
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

// ---- request helper ----

async function errorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.message === 'string') return data.message;
    if (data?.errors && typeof data.errors === 'object') {
      const first = (Object.values(data.errors) as string[][]).flat()[0];
      if (first) return first;
    }
    if (typeof data?.title === 'string') return data.title;
  } catch {
    // The body was empty or not JSON.
  }
  if (res.status === 403) return 'You do not have permission to do that.';
  if (res.status === 404) return 'That item was not found.';
  return `Request failed (${res.status}).`;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const session = loadSession();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session) headers['Authorization'] = `Bearer ${session.token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Please try again.');
  }

  if (!res.ok) {
    // An expired or invalid token while signed in: sign the user out.
    if (res.status === 401 && session && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, await errorMessage(res));
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- endpoints ----

export function login(email: string, password: string): Promise<Session> {
  return request<Session>('POST', '/api/auth/login', { email, password });
}

export function getVehicles(filters: { status?: string; location?: string; search?: string }): Promise<Vehicle[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value.trim()) params.set(key, value.trim());
  }
  const qs = params.toString();
  return request<Vehicle[]>('GET', `/api/vehicles${qs ? `?${qs}` : ''}`);
}

export function getVehicle(id: number): Promise<VehicleDetails> {
  return request<VehicleDetails>('GET', `/api/vehicles/${id}`);
}

export function createVehicle(body: VehicleRequest): Promise<Vehicle> {
  return request<Vehicle>('POST', '/api/vehicles', body);
}

export function updateVehicle(id: number, body: VehicleRequest): Promise<Vehicle> {
  return request<Vehicle>('PUT', `/api/vehicles/${id}`, body);
}

export function getBookings(): Promise<Booking[]> {
  return request<Booking[]>('GET', '/api/bookings');
}

export function createBooking(body: CreateBookingRequest): Promise<Booking> {
  return request<Booking>('POST', '/api/bookings', body);
}

export function cancelBooking(id: number): Promise<void> {
  return request<void>('DELETE', `/api/bookings/${id}`);
}

export function logService(vehicleId: number, body: LogServiceRequest): Promise<LogServiceResult> {
  return request<LogServiceResult>('POST', `/api/vehicles/${vehicleId}/services`, body);
}

export function getAlerts(): Promise<AlertsResponse> {
  return request<AlertsResponse>('GET', '/api/alerts');
}

export function getFleetSummary(): Promise<FleetSummary> {
  return request<FleetSummary>('GET', '/api/fleet/summary');
}
