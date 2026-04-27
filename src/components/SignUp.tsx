import { useState } from 'react';
import { Shield, Mail, Lock, User, AlertCircle, CheckCircle, Cpu, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';

interface SignUpProps {
  onToggleMode: () => void;
}

export const SignUp = ({ onToggleMode }: SignUpProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      showToast('error', 'Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    const { error: authError } = await signUp(email, password, username);

    if (authError) {
      setError(authError.message);
      showToast('error', authError.message);
      setLoading(false);
    } else {
      setSuccess(true);
      showToast('success', 'Account created successfully! Redirecting to login...');
      // ✅ 1.5 second baad automatically login page pe switch
      setTimeout(() => {
        onToggleMode();
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 overflow-hidden font-sans">
      {/* Cyber Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-500/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-md"
      >
        <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-cyan-500 rounded-2xl blur opacity-20 transition duration-1000"></div>

        <div className="relative bg-gray-900/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 shadow-2xl">

          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 mb-4"
            >
              <Shield className="w-10 h-10 text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
            </motion.div>
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight">
              AxelleVault
            </h1>
            <p className="text-green-500/70 text-xs font-mono mt-2 flex items-center justify-center gap-2">
              <Cpu className="w-3 h-3" /> NEW IDENTITY REGISTRATION
            </p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center text-red-400 text-sm"
              >
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center text-green-400 text-sm"
              >
                <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                Account created! Redirecting to login...
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                Username
              </label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-green-400 transition-colors" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/40 border border-gray-700 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all"
                  placeholder="hacker_alias"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-green-400 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-gray-700 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-green-400 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-gray-700 rounded-xl pl-10 pr-12 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-green-400 transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-600 ml-1">Minimum 8 characters required</p>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading || success}
              className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-green-600 to-cyan-600 p-px font-semibold text-white shadow-[0_0_20px_rgba(74,222,128,0.3)] disabled:opacity-50"
            >
              <div className="relative flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 transition-all group-hover:bg-transparent">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Account...
                  </span>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    <span>Register Identity</span>
                  </>
                )}
              </div>
            </motion.button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <button
              onClick={onToggleMode}
              className="text-gray-400 hover:text-green-400 text-sm transition-all duration-300"
            >
              Already registered?{' '}
              <span className="text-green-400 font-bold hover:underline underline-offset-4">Sign In</span>
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center px-2">
          <div className="flex gap-2 items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-ping"></div>
            <span className="text-[10px] text-gray-500 font-mono">SECURE REGISTRATION</span>
          </div>
          <p className="text-gray-600 text-[10px] font-mono tracking-widest uppercase">
            © 2026 AXELLE-CORP
          </p>
        </div>
      </motion.div>
    </div>
  );
};