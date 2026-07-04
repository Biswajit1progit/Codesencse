import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import AuthCallback from './pages/AuthCallback';

// Protected route — redirects to home if not logged in
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{
      minHeight: '100vh',
      background: '#020817',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#94a3b8',
      fontFamily: 'sans-serif'
    }}>
      Loading...
    </div>
  );

  if (!user) return <Navigate to="/" replace />;
  return children;
};

// Public route — redirects to dashboard if already logged in
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{
      minHeight: '100vh',
      background: '#020817',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#94a3b8',
      fontFamily: 'sans-serif'
    }}>
      Loading...
    </div>
  );

  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public — if logged in, go to dashboard */}
          <Route path="/" element={
            <PublicRoute>
              <Home />
            </PublicRoute>
          } />

          {/* Auth callback — no protection needed */}
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected — if not logged in, go to home */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;