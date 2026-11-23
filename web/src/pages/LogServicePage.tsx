import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, getVehicle, logService, type LogServiceResult, type VehicleDetails } from '../api';
import { todayIso } from '../bookingValidation';
import { formatDate } from '../format';

interface ServiceErrors {
  date?: string;
  odometerKm?: string;
  type?: string;
  cost?: string;
}

export default function LogServicePage() {
  const { id } = useParams<{ id: string }>();
  const vehicleId = Number(id);
  const invalid = !Number.isInteger(vehicleId) || vehicleId <= 0;

  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [odometerKm, setOdometerKm] = useState('');
  const [type, setType] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<ServiceErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<LogServiceResult | null>(null);
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
    const next: ServiceErrors = {};
    if (!date) next.date = 'Choose the service date.';
    if (odometerKm === '' || Number(odometerKm) < 0) next.odometerKm = 'Enter the odometer reading in km.';
    if (!type.trim()) next.type = 'Enter the type of service.';
    if (cost === '' || Number(cost) < 0) next.cost = 'Enter the cost (0 or more).';
    setErrors(next);
    setServerError(null);
    setResult(null);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const saved = await logService(vehicleId, {
        date,
        odometerKm: Number(odometerKm),
        type: type.trim(),
        cost: Number(cost),
        notes: notes.trim() || undefined
      });
      setResult(saved);
      setOdometerKm('');
      setType('');
      setCost('');
      setNotes('');
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
        <Link to={`/vehicles/${invalid ? '' : vehicleId}`}>&larr; Back to vehicle</Link>
      </p>
      <h1>Log a service</h1>

      {message && (
        <p role="alert" className="error-banner">
          {message}
        </p>
      )}
      {!vehicle && !message && <p className="muted">Loading vehicle...</p>}

      {vehicle && (
        <>
          <div className="card">
            <strong>{vehicle.rego}</strong>
            <p className="muted">{`${vehicle.year} ${vehicle.make} ${vehicle.model} · Next service due ${formatDate(vehicle.nextServiceDue)}`}</p>
          </div>

          {result && (
            <p role="status" className="success-banner">
              {`Service logged. Next service due ${formatDate(result.nextServiceDue)}.`}
            </p>
          )}
          {serverError && (
            <p role="alert" className="error-banner">
              {serverError}
            </p>
          )}

          <form className="card" onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="service-date">Service date</label>
              <input
                id="service-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-invalid={errors.date ? true : undefined}
              />
              {errors.date && <p className="error-text">{errors.date}</p>}
            </div>

            <div className="field">
              <label htmlFor="service-odometer">Odometer (km)</label>
              <input
                id="service-odometer"
                type="number"
                min="0"
                value={odometerKm}
                onChange={(e) => setOdometerKm(e.target.value)}
                aria-invalid={errors.odometerKm ? true : undefined}
              />
              {errors.odometerKm && <p className="error-text">{errors.odometerKm}</p>}
            </div>

            <div className="field">
              <label htmlFor="service-type">Service type</label>
              <input
                id="service-type"
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                aria-invalid={errors.type ? true : undefined}
              />
              {errors.type && <p className="error-text">{errors.type}</p>}
            </div>

            <div className="field">
              <label htmlFor="service-cost">Cost ($)</label>
              <input
                id="service-cost"
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                aria-invalid={errors.cost ? true : undefined}
              />
              {errors.cost && <p className="error-text">{errors.cost}</p>}
            </div>

            <div className="field">
              <label htmlFor="service-notes">Notes (optional)</label>
              <input id="service-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Saving...' : 'Log service'}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
