import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, getVehicle, type VehicleDetails } from '../api';
import { useAuth } from '../auth';
import { BookingStatusBadge, VehicleStatusBadge } from '../components/Badges';
import {
  daysUntil,
  formatDate,
  formatKm,
  formatMoney,
  leaseNotice,
  regoNotice,
  serviceNotice,
  type Notice
} from '../format';

function NoticeBadge({ notice }: { notice: Notice | null }) {
  return notice ? <span className={`badge ${notice.tone}`}>{notice.label}</span> : null;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function VehicleBody({ vehicle, isDriver }: { vehicle: VehicleDetails; isDriver: boolean }) {
  return (
    <>
      <div className="row between">
        <h1>{vehicle.rego}</h1>
        <VehicleStatusBadge status={vehicle.status} />
      </div>
      <p className="muted">{`${vehicle.year} ${vehicle.make} ${vehicle.model}`}</p>
      {!isDriver && (
        <p>
          <Link to={`/vehicles/${vehicle.id}/log-service`}>Log a service</Link>
        </p>
      )}
      {vehicle.status === 'Available' && (
        <p>
          <Link to={`/vehicles/${vehicle.id}/book`}>Book this car</Link>
        </p>
      )}

      <div className="card">
        <dl className="details">
          <Detail label="Location">{vehicle.location}</Detail>
          <Detail label="Odometer">{formatKm(vehicle.odometerKm)}</Detail>
          <Detail label="Rego expiry">
            {formatDate(vehicle.regoExpiry)}
            <NoticeBadge notice={regoNotice(daysUntil(vehicle.regoExpiry))} />
          </Detail>
          <Detail label="Next service due">
            {formatDate(vehicle.nextServiceDue)}
            <NoticeBadge notice={serviceNotice(daysUntil(vehicle.nextServiceDue))} />
          </Detail>
          <Detail label="Lease ends">
            {formatDate(vehicle.leaseEnd)}
            <NoticeBadge notice={leaseNotice(daysUntil(vehicle.leaseEnd))} />
          </Detail>
        </dl>
      </div>

      <h2>Booking history</h2>
      {isDriver && <p className="muted small">You can only see your own bookings.</p>}
      {vehicle.bookings.length === 0 ? (
        <p className="card muted">No bookings yet.</p>
      ) : (
        <div className="card table-wrap">
          <table aria-label="Booking history">
            <thead>
              <tr>
                <th>Dates</th>
                <th>Driver</th>
                <th>Purpose</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicle.bookings.map((b) => (
                <tr key={b.id}>
                  <td>{`${formatDate(b.startDate)} to ${formatDate(b.endDate)}`}</td>
                  <td>{b.driverName}</td>
                  <td>{b.purpose}</td>
                  <td>
                    <BookingStatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Service history</h2>
      {vehicle.services.length === 0 ? (
        <p className="card muted">No services recorded.</p>
      ) : (
        <div className="card table-wrap">
          <table aria-label="Service history">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Odometer</th>
                <th>Cost</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {vehicle.services.map((s) => (
                <tr key={s.id}>
                  <td>{formatDate(s.date)}</td>
                  <td>{s.type}</td>
                  <td>{formatKm(s.odometerKm)}</td>
                  <td>{formatMoney(s.cost)}</td>
                  <td>{s.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function VehicleDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const vehicleId = Number(id);
  const invalid = !Number.isInteger(vehicleId) || vehicleId <= 0;

  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invalid) return;
    let ignore = false;
    setVehicle(null);
    setError(null);
    getVehicle(vehicleId)
      .then((v) => {
        if (!ignore) setVehicle(v);
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      });
    return () => {
      ignore = true;
    };
  }, [vehicleId, invalid]);

  const message = invalid ? 'That vehicle was not found.' : error;

  return (
    <section>
      <p>
        <Link to="/vehicles">&larr; All vehicles</Link>
      </p>
      {message && (
        <p role="alert" className="error-banner">
          {message}
        </p>
      )}
      {!vehicle && !message && <p className="muted">Loading vehicle...</p>}
      {vehicle && <VehicleBody vehicle={vehicle} isDriver={session?.role === 'Driver'} />}
    </section>
  );
}
