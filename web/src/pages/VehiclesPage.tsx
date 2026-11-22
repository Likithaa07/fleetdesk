import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, getVehicles, type Vehicle } from '../api';
import { VehicleStatusBadge } from '../components/Badges';
import { formatKm } from '../format';

const SEARCH_DELAY_MS = 300;

export default function VehiclesPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [location, setLocation] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Wait a moment after the last keystroke before asking the API.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // The location filter lists every location in the fleet, so load the full list once.
  useEffect(() => {
    let ignore = false;
    getVehicles({})
      .then((all) => {
        if (!ignore) setLocations(Array.from(new Set(all.map((v) => v.location))).sort());
      })
      .catch(() => {
        // Without the full list the filter just offers "All locations".
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Load the filtered list. An older response that arrives late is ignored.
  useEffect(() => {
    let ignore = false;
    setError(null);
    getVehicles({ status, location, search: debouncedSearch })
      .then((list) => {
        if (!ignore) setVehicles(list);
      })
      .catch((err) => {
        if (ignore) return;
        setVehicles(null);
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      });
    return () => {
      ignore = true;
    };
  }, [status, location, debouncedSearch]);

  const hasFilters = Boolean(search || status || location);
  const loading = vehicles === null && error === null;

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setStatus('');
    setLocation('');
  }

  return (
    <section>
      <h1>Vehicles</h1>

      <div className="card">
        <div className="filters">
          <div className="field">
            <label htmlFor="vehicle-search">Search</label>
            <input
              id="vehicle-search"
              type="search"
              placeholder="Rego, make or model"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="vehicle-status">Status</label>
            <select id="vehicle-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="Available">Available</option>
              <option value="InService">In service</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="vehicle-location">Location</label>
            <select id="vehicle-location" value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">All locations</option>
              {locations.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" onClick={clearFilters} disabled={!hasFilters}>
          Clear filters
        </button>
      </div>

      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {loading && <p className="muted">Loading vehicles...</p>}

      {vehicles && (
        <>
          <p className="muted" aria-live="polite">
            {`${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}`}
          </p>
          {vehicles.length === 0 ? (
            <p className="card">No vehicles match your filters.</p>
          ) : (
            <ul className="vehicle-grid">
              {vehicles.map((v) => (
                <li key={v.id} className="card vehicle-card">
                  <div className="row between">
                    <Link to={`/vehicles/${v.id}`} className="rego">
                      {v.rego}
                    </Link>
                    <VehicleStatusBadge status={v.status} />
                  </div>
                  <p>{`${v.year} ${v.make} ${v.model}`}</p>
                  <p className="muted small">{`${v.location} · ${formatKm(v.odometerKm)}`}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
