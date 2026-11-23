import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, getAlerts, getFleetSummary, type Alert, type AlertsResponse, type FleetSummary } from '../api';
import { formatDate } from '../format';

function alertTone(type: Alert['type']): 'bad' | 'warn' {
  return type === 'ServiceOverdue' || type === 'RegoExpired' ? 'bad' : 'warn';
}

function alertTitle(type: Alert['type']): string {
  switch (type) {
    case 'ServiceOverdue':
      return 'Service overdue';
    case 'RegoExpired':
      return 'Rego expired';
    case 'RegoExpiring':
      return 'Rego expiring soon';
    case 'LeaseEnding':
      return 'Lease ending soon';
  }
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<FleetSummary | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setError(null);
    Promise.all([getFleetSummary(), getAlerts()])
      .then(([s, a]) => {
        if (ignore) return;
        setSummary(s);
        setAlerts(a);
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      });
    return () => {
      ignore = true;
    };
  }, []);

  const loading = !summary && !alerts && !error;

  return (
    <section>
      <h1>Dashboard</h1>

      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {loading && <p className="muted">Loading dashboard...</p>}

      {summary && (
        <div className="grid" aria-label="Fleet counts">
          <div className="card">
            <p className="stat">{summary.total}</p>
            <p className="muted">Total vehicles</p>
          </div>
          <div className="card">
            <p className="stat">{summary.available}</p>
            <p className="muted">Available</p>
          </div>
          <div className="card">
            <p className="stat">{summary.inService}</p>
            <p className="muted">In service</p>
          </div>
        </div>
      )}

      {alerts && (
        <>
          <h2>Alerts</h2>
          {alerts.alerts.length === 0 ? (
            <p className="card">No alerts. Everything is up to date.</p>
          ) : (
            <ul className="alert-list">
              {alerts.alerts.map((a) => (
                <li key={`${a.vehicleId}-${a.type}`} className="card alert-card">
                  <div className="row between">
                    <Link to={`/vehicles/${a.vehicleId}`} className="rego">
                      {a.rego}
                    </Link>
                    <span className={`badge ${alertTone(a.type)}`}>{alertTitle(a.type)}</span>
                  </div>
                  <p>{`${a.make} ${a.model}`}</p>
                  <p className="muted small">{`${a.message} (${formatDate(a.dueDate)})`}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
