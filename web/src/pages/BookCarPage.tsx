import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, createBooking, getVehicle, type VehicleDetails } from '../api';
import { VehicleStatusBadge } from '../components/Badges';
import { todayIso, validateBooking, type BookingErrors } from '../bookingValidation';

export default function BookCarPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const vehicleId = Number(id);
  const invalid = !Number.isInteger(vehicleId) || vehicleId <= 0;

  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [errors, setErrors] = useState<BookingErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (invalid) return;
    let ignore = false;
    setVehicle(null);
    setLoadError(null);
    getVehicle(vehicleId)
      .then((v) => {
        if (!ignore) setVehicle(v);
      })
      .catch((err) => {
        if (!ignore) setLoadError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      });
    return () => {
      ignore = true;
    };
  }, [vehicleId, invalid]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validateBooking({ startDate, endDate, purpose });
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await createBooking({ vehicleId, startDate, endDate, purpose: purpose.trim() });
      navigate('/bookings', { state: { booked: vehicle?.rego ?? 'the vehicle' } });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const message = invalid ? 'That vehicle was not found.' : loadError;

  return (
    <section>
      <p>
        <Link to="/vehicles">&larr; All vehicles</Link>
      </p>
      <h1>Book a car</h1>

      {message && (
        <p role="alert" className="error-banner">
          {message}
        </p>
      )}
      {!vehicle && !message && <p className="muted">Loading vehicle...</p>}

      {vehicle && (
        <>
          <div className="card">
            <div className="row between">
              <strong>{vehicle.rego}</strong>
              <VehicleStatusBadge status={vehicle.status} />
            </div>
            <p className="muted">{`${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.location}`}</p>
          </div>

          <form className="card" onSubmit={onSubmit} noValidate>
            {serverError && (
              <p role="alert" className="error-banner">
                {serverError}
              </p>
            )}

            <div className="field">
              <label htmlFor="start-date">Start date</label>
              <input
                id="start-date"
                type="date"
                min={todayIso()}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-invalid={errors.startDate ? true : undefined}
                aria-describedby={errors.startDate ? 'start-date-error' : undefined}
              />
              {errors.startDate && (
                <p id="start-date-error" className="error-text">
                  {errors.startDate}
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor="end-date">End date</label>
              <input
                id="end-date"
                type="date"
                min={startDate || todayIso()}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-invalid={errors.endDate ? true : undefined}
                aria-describedby={errors.endDate ? 'end-date-error' : undefined}
              />
              {errors.endDate && (
                <p id="end-date-error" className="error-text">
                  {errors.endDate}
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor="purpose">Purpose</label>
              <input
                id="purpose"
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                aria-invalid={errors.purpose ? true : undefined}
                aria-describedby={errors.purpose ? 'purpose-error' : undefined}
              />
              {errors.purpose && (
                <p id="purpose-error" className="error-text">
                  {errors.purpose}
                </p>
              )}
            </div>

            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Booking...' : 'Book this car'}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
