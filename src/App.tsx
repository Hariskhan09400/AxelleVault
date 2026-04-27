import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Profile } from './components/Profile';
import { Settings } from './components/Settings';
import { ForgotPassword } from './components/ForgotPassword';
import { ResetPassword } from './components/ResetPassword';
import { useAuth } from './hooks/useAuth';
import { ToastProvider } from './contexts/ToastContext';

import IPChat from './components/tools/ipchat';
import DarkWebExposureChecker from './components/tools/DarkWebExposureChecker';

// ─── Protected route — login nahi toh /login pe bhejo ─────
const AuthGate = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
        <p className="text-xs font-mono tracking-widest text-cyan-500/60 animate-pulse uppercase">
          Loading...
        </p>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
};

// ─── Public route — logged in hai toh dashboard pe bhejo ──
const PublicOnly = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  // ✅ Sirf tab redirect karo jab user actually logged in ho
  return user ? <Navigate to="/dashboard" replace /> : children;
};

// ─── Login page wrapper ────────────────────────────────────
const LoginPage = () => {
  const navigate = useNavigate();
  return (
    <Login
      onToggleMode={() => navigate('/login')}   // signup ke baad yahan aao
      onForgotPassword={() => navigate('/forgot-password')}
    />
  );
};

// ─── Forgot password page ──────────────────────────────────
const ForgotPage = () => {
  const navigate = useNavigate();
  return <ForgotPassword onBack={() => navigate('/login')} />;
};

// ─── App ──────────────────────────────────────────────────
function App() {
  return (
    <ToastProvider>
      <Routes>
        {/* Root → dashboard (AuthGate handle karega redirect) */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Public routes */}
        <Route path="/login"          element={<PublicOnly><LoginPage /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPage /></PublicOnly>} />
        <Route path="/reset-password"  element={<ResetPassword />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={<AuthGate><Dashboard /></AuthGate>} />
        <Route path="/profile"   element={<AuthGate><Profile /></AuthGate>} />
        <Route path="/settings"  element={<AuthGate><Settings /></AuthGate>} />

        {/* Tools */}
        <Route path="/tools"           element={<AuthGate><Navigate to="/tools/ipchat" replace /></AuthGate>} />
        <Route path="/tools/ipchat"    element={<AuthGate><IPChat /></AuthGate>} />
        <Route path="/tools/darkweb"   element={<AuthGate><DarkWebExposureChecker /></AuthGate>} />
        <Route path="/tools/:toolId"   element={<AuthGate><Dashboard /></AuthGate>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ToastProvider>
  );
}

export default App;