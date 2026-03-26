import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Login } from './components/Login';
import { SignUp } from './components/SignUp';
import { Dashboard } from './components/Dashboard';
import { useAuth } from './hooks/useAuth';

const AuthGate = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-cyan-400 grid place-items-center">
        Initializing secure session...
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
};

const PublicOnly = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
};

const LoginPage = () => {
  const navigate = useNavigate();
  return <Login onToggleMode={() => navigate('/signup')} />;
};

const SignUpPage = () => {
  const navigate = useNavigate();
  return <SignUp onToggleMode={() => navigate('/login')} />;
};

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/login"
          element={
            <PublicOnly>
              <LoginPage />
            </PublicOnly>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnly>
              <SignUpPage />
            </PublicOnly>
          }
        />
        <Route
          path="/dashboard"
          element={
            <AuthGate>
              <Dashboard />
            </AuthGate>
          }
        />
        <Route
          path="/tools"
          element={
            <AuthGate>
              <Navigate to="/tools/password-generator" replace />
            </AuthGate>
          }
        />
        <Route
          path="/tools/:toolId"
          element={
            <AuthGate>
              <Dashboard />
            </AuthGate>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

export default App;
