import type { Booking, Vehicle } from '../api';

export function VehicleStatusBadge({ status }: { status: Vehicle['status'] }) {
  return status === 'Available' ? (
    <span className="badge good">Available</span>
  ) : (
    <span className="badge warn">In service</span>
  );
}

export function BookingStatusBadge({ status }: { status: Booking['status'] }) {
  return status === 'Active' ? <span className="badge good">Active</span> : <span className="badge">Cancelled</span>;
}
