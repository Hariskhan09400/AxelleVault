import { useState } from 'react';
import { Shield, Mail, Lock, AlertCircle, Cpu, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { hasSupabaseEnv } from '../lib/supabase';

interface LoginProps {
  onToggleMode: () => void;
  onForgotPassword: () => void;
}

export const Login = ({ onToggleMode, onForgotPassword }: LoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false); // ✅ Remember Me state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // ✅ Remember Me: email ko localStorage me save karo
    if (rememberMe) {
      localStorage.setItem('rememberedEmail', email);
    } else {
      localStorage.removeItem('rememberedEmail');
    }

    const { error: authError } = await signIn(email, password);

    if (authError) {
      setError(authError.message);
      showToast('error', authError.message);
    } else {
      showToast('success', 'Login successful. Welcome to AxelleVault.');
    }

    setLoading(false);
  };

  // ✅ Remembered email auto-fill on mount
  useState(() => {
    const saved = localStorage.getItem('rememberedEmail');
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  });

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 overflow-hidden font-sans">
      {/* Dynamic Cyber Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-md"
      >
        {/* Glowing Border Effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-green-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>

        <div className="relative bg-gray-900/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 shadow-2xl">

          {/* Header Section */}
          <div className="text-center mb-10">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-4"
            >
              <Shield className="w-10 h-10 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            </motion.div>
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight">
              AxelleVault
            </h1>
            <p className="text-cyan-500/70 text-xs font-mono mt-2 flex items-center justify-center gap-2">
              <Cpu className="w-3 h-3" /> ENCRYPTED TERMINAL v2.0.4
            </p>
          </div>

          {!hasSupabaseEnv && (
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 text-xs text-yellow-200/80 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
              <p>Critical: Environment variables missing. Ensure <code className="text-white">VITE_SUPABASE_URL</code> is configured.</p>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center text-red-400 text-sm"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                Authorization Email
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-gray-700 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  placeholder="admin@axelle.vault"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                Access Key
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-gray-700 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* ✅ Remember Me Checkbox */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className={`relative w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                  rememberMe
                    ? 'bg-cyan-500 border-cyan-500'
                    : 'bg-transparent border-gray-600 hover:border-cyan-500/50'
                }`}
              >
                {rememberMe && (
                  <motion.svg
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </motion.svg>
                )}
              </button>
              <span className="text-sm text-gray-400 select-none cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                Remember my access credentials
              </span>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-cyan-600 to-green-600 p-px font-semibold text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50"
            >
              <div className="relative flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 transition-all group-hover:bg-transparent">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  <>
                    <Fingerprint className="w-5 h-5" />
                    <span>Initialize Access</span>
                  </>
                )}
              </div>
            </motion.button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center space-y-2">
            <button
              onClick={onForgotPassword}
              className="text-gray-400 hover:text-cyan-400 text-sm transition-all duration-300"
            >
              Forgot your access key?{' '}
              <span className="text-cyan-400 font-bold hover:underline underline-offset-4">Recover Account</span>
            </button>
            <button
              onClick={onToggleMode}
              className="text-gray-400 hover:text-cyan-400 text-sm transition-all duration-300"
            >
              System newcomer?{' '}
              <span className="text-cyan-400 font-bold hover:underline underline-offset-4">Register Identity</span>
            </button>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="mt-6 flex justify-between items-center px-2">
          <div className="flex gap-2 items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-ping"></div>
            <span className="text-[10px] text-gray-500 font-mono">ENCRYPTION ACTIVE</span>
          </div>
          <p className="text-gray-600 text-[10px] font-mono tracking-widest uppercase">
            © 2026 AXELLE-CORP
          </p>
        </div>
      </motion.div>
    </div>
  );
};