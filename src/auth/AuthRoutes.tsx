import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { WorkspaceShell } from '../components/WorkspaceShell';
import { useAuth } from './AuthContext';

export function ProtectedRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <main className="auth-loading" role="status">Turning the little key…</main>;
  }
  if (!user) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }

  return <WorkspaceShell><Outlet /></WorkspaceShell>;
}
