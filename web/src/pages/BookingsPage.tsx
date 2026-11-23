import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ApiError, cancelBooking, getBookings, type Booking } from '../api';
import { useAuth } from '../auth';
import { BookingStatusBadge } from '../components/Badges';
import { formatDate } from '../format';

export default function BookingsPage() {
  const { session } = useAuth();
  const location = useLocation();
  const isManager = session?.role === 'Manager';
  const booked = (location.state as { booked?: string } | null)?.booked;

  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const load = useCallback(() => {
    let ignore = false;
    setError(null);
    getBookings()
      .then((list) => {
        if (!ignore) setBookings(list);
      })
      .catch((err) => {
        if (ignore) return;
        setBookings(null);
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  async function onCancel(id: number) {
    setActionError(null);
    setCancellingId(id);
    try {
      await cancelBooking(id);
      setBookings((current) =>
        current ? current.map((b) => (b.id === id ? { ...b, status: 'Cancelled' as const } : b)) : current
      );
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setCancellingId(null);
    }
  }

  const loading = bookings === null && error === null;

  return (
    <section>
      <h1>{isManager ? 'All bookings' : 'My bookings'}</h1>

      {booked && (
        <p role="status" className="success-banner">
          {`Booked ${booked}.`}
        </p>
      )}
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {actionError && (
        <p role="alert" className="error-banner">
          {actionError}
        </p>
      )}
      {loading && <p className="muted">Loading bookings...</p>}

      {bookings && bookings.length === 0 && (
        <div className="card">
          <p>No bookings yet.</p>
          <Link to="/vehicles">Browse vehicles</Link>
        </div>
      )}

      {bookings && bookings.length > 0 && (
        <div className="card table-wrap">
          <table aria-label="Bookings">
            <thead>
              <tr>
                <th>Vehicle</th>
                {isManager && <th>Driver</th>}
                <th>Dates</th>
                <th>Purpose</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link to={`/vehicles/${b.vehicleId}`}>{b.rego}</Link>
                  </td>
                  {isManager && <td>{b.driverName}</td>}
                  <td>{`${formatDate(b.startDate)} to ${formatDate(b.endDate)}`}</td>
                  <td>{b.purpose}</td>
                  <td>
                    <BookingStatusBadge status={b.status} />
                  </td>
                  <td>
                    {b.status === 'Active' && (
                      <button
                        type="button"
                        className="danger"
                        disabled={cancellingId === b.id}
                        onClick={() => onCancel(b.id)}
                        aria-label={`Cancel booking for ${b.rego}`}
                      >
                        {cancellingId === b.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
