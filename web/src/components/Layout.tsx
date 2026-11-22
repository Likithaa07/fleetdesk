import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Layout() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const isManager = session?.role === 'Manager';

  function signOut() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">FleetDesk</span>
        <nav aria-label="Main">
          {isManager && <NavLink to="/dashboard">Dashboard</NavLink>}
          <NavLink to="/vehicles">Vehicles</NavLink>
          <NavLink to="/bookings">{isManager ? 'All bookings' : 'My bookings'}</NavLink>
        </nav>
        <div className="user">
          <span>
            {session?.name} ({session?.role})
          </span>
          <button type="button" className="link-button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
