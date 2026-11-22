import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import type { Role } from '../api';

// Sends signed-out users to the login page. If a role is given, other roles go back to the home page.
export default function RequireAuth({ children, role }: { children: ReactNode; role?: Role }) {
  const { session } = useAuth();
  const location = useLocation();

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && session.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}
