import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import BookCarPage from './pages/BookCarPage';
import BookingsPage from './pages/BookingsPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import LogServicePage from './pages/LogServicePage';
import VehicleDetailsPage from './pages/VehicleDetailsPage';
import VehiclesPage from './pages/VehiclesPage';
import { useAuth } from './auth';

function Home() {
  const { session } = useAuth();
  return (
    <section className="card">
      <h1>Welcome, {session?.name}</h1>
      <p className="muted">You are signed in as a {session?.role}.</p>
    </section>
  );
}

function NotFound() {
  return (
    <section className="card">
      <h1>Page not found</h1>
      <p className="muted">That page does not exist.</p>
    </section>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Home />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth role="Manager">
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/vehicles/:id" element={<VehicleDetailsPage />} />
        <Route path="/vehicles/:id/book" element={<BookCarPage />} />
        <Route
          path="/vehicles/:id/log-service"
          element={
            <RequireAuth role="Manager">
              <LogServicePage />
            </RequireAuth>
          }
        />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
