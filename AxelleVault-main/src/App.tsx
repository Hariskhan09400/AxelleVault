import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Login } from './components/Login';
import { SignUp } from './components/SignUp';
import { Dashboard } from './components/Dashboard';
import { Profile } from './components/Profile';
import { Settings } from './components/Settings';
import { ForgotPassword } from './components/ForgotPassword';
import { ResetPassword } from './components/ResetPassword';
import { useAuth } from './hooks/useAuth';
import { ToastProvider } from './contexts/ToastContext';

import IPChat from './components/tools/ipchat';
import DarkWebExposureChecker from "./components/tools/DarkWebExposureChecker";

const AuthGate = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-cyan-400 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
        <p className="text-sm font-mono tracking-widest text-cyan-500/70 animate-pulse">
          INITIALIZING SECURE SESSION...
        </p>
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
  return (
    <Login
      onToggleMode={() => navigate('/signup')}
      onForgotPassword={() => navigate('/forgot-password')}
    />
  );
};

const SignUpPage = () => {
  const navigate = useNavigate();
  return <SignUp onToggleMode={() => navigate('/login')} />;
};

const ForgotPage = () => {
  const navigate = useNavigate();
  return <ForgotPassword onBack={() => navigate('/login')} />;
};

function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><SignUpPage /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPage /></PublicOnly>} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/dashboard" element={<AuthGate><Dashboard /></AuthGate>} />
        <Route path="/profile" element={<AuthGate><Profile /></AuthGate>} />
        <Route path="/settings" element={<AuthGate><Settings /></AuthGate>} />

        <Route path="/tools" element={<AuthGate><Navigate to="/tools/ipchat" replace /></AuthGate>} />
        <Route path="/tools/ipchat" element={<AuthGate><IPChat /></AuthGate>} />
        <Route path="/tools/darkweb" element={<AuthGate><DarkWebExposureChecker /></AuthGate>} />
        <Route path="/tools/:toolId" element={<AuthGate><Dashboard /></AuthGate>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ToastProvider>
  );
}

export default App;