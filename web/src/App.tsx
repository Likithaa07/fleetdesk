import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import LoginPage from './pages/LoginPage';
import { useAuth } from './auth';

function Home() {
  const { session } = useAuth();
  return (
    <section className="card">
      <h1>Welcome, {session?.name}</h1>
      <p className="muted">You are signed in as a {session?.role}. The pages are coming next.</p>
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
      </Route>
    </Routes>
  );
}
