import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ApiError } from '../api';

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const next: FieldErrors = {};
    if (!email.trim()) next.email = 'Enter your email.';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={onSubmit} noValidate>
        <h1>FleetDesk</h1>
        <p className="muted">Sign in to manage and book company vehicles.</p>

        {serverError && (
          <p role="alert" className="error-banner">
            {serverError}
          </p>
        )}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && (
            <p id="email-error" className="error-text">
              {errors.email}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? 'password-error' : undefined}
          />
          {errors.password && (
            <p id="password-error" className="error-text">
              {errors.password}
            </p>
          )}
        </div>

        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>

        <p className="muted small">
          Demo accounts (fake data): manager@fleetdesk.test or driver1@fleetdesk.test, password Password123!
        </p>
      </form>
    </div>
  );
}
