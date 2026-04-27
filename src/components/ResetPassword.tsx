import { useState, useEffect } from 'react';
import { Shield, Lock, AlertCircle, CheckCircle, Eye, EyeOff, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isRecoveryTokenValid, setIsRecoveryTokenValid] = useState<boolean | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const navigate = useNavigate();

  const parseJwt = (token: string) => {
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decodeURIComponent(escape(decoded)));
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const checkTokenAndSession = async () => {
      const url = new URL(window.location.href);
      const accessToken = url.searchParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token');
      const type = url.searchParams.get('type');
      setResetToken(accessToken);

      if (!accessToken || type !== 'recovery') {
        setError('Reset link is invalid or missing; please request a new reset link.');
        setIsRecoveryTokenValid(false);
        return;
      }

      setInfo('Validating reset link...');
      const jwtData = parseJwt(accessToken);
      if (!jwtData || !jwtData.exp) {
        setError('Unable to parse reset token. Request a new reset email.');
        setIsRecoveryTokenValid(false);
        return;
      }

      const exp = Number(jwtData.exp);
      const now = Math.floor(Date.now() / 1000);
      if (now > exp) {
        setError('The password reset link has expired. Please request a new reset link.');
        setIsRecoveryTokenValid(false);
        return;
      }

      const session = await supabase.auth.getSession();
      if (!session?.data?.session?.user) {
        if (typeof supabase.auth.setSession === 'function' && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      }

      const finalSession = await supabase.auth.getSession();
      if (!finalSession?.data?.session?.user) {
        setError('Unable to establish a secure session for password recovery. Please use the reset email link again.');
        setIsRecoveryTokenValid(false);
      } else {
        setIsRecoveryTokenValid(true);
        setInfo('Reset link validated. Set your new password below.');
      }
    };

    checkTokenAndSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('[ResetPassword] PASSWORD_RECOVERY event received');
        setIsRecoveryTokenValid(!!session?.user);
        if (session?.user) setInfo('Recovery session restored.');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const getStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = getStrength(password);
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'][strength];
  const strengthColor = ['', '#ef4444', '#f97316', '#eab308', '#22d3ee', '#10b981'][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isRecoveryTokenValid) {
      setError('Reset token invalid or expired. Please request a new reset link.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      if (updateError.message.toLowerCase().includes('expired') || updateError.message.toLowerCase().includes('invalid')) {
        setIsRecoveryTokenValid(false);
      }
    } else {
      setDone(true);
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login'), 2500);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-md"
      >
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-green-500 rounded-2xl blur opacity-20" />

        <div className="relative bg-gray-900/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 shadow-2xl">

          <div className="text-center mb-8">
            {info && (
              <div className="mb-3 text-xs text-cyan-300 bg-cyan-900/40 border border-cyan-500/20 rounded-lg p-2">
                {info}
              </div>
            )}
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
              <Cpu className="w-3 h-3" /> SET NEW ACCESS KEY
            </p>
          </div>

          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-white font-bold text-lg">Access Key Updated</h3>
                <p className="text-gray-400 text-sm">
                  Your credentials have been secured. Redirecting to login...
                </p>
                <div className="w-full bg-gray-700 rounded-full h-1 mt-4">
                  <motion.div
                    className="h-1 bg-cyan-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3 }}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center text-red-400 text-sm"
                    >
                      <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* New Password */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                      New Access Key
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-black/40 border border-gray-700 rounded-xl pl-10 pr-12 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cyan-400 transition"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Strength bar */}
                    {password && (
                      <div>
                        <div className="flex gap-1 mt-1">
                          {[1,2,3,4,5].map((i) => (
                            <div
                              key={i}
                              className="flex-1 h-1 rounded-full transition-all duration-300"
                              style={{ backgroundColor: i <= strength ? strengthColor : '#1e293b' }}
                            />
                          ))}
                        </div>
                        <p className="text-xs mt-1 font-mono" style={{ color: strengthColor }}>
                          {strengthLabel}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                      Confirm Access Key
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full bg-black/40 border rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 transition-all ${
                          confirmPassword && password !== confirmPassword
                            ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20'
                            : 'border-gray-700 focus:border-cyan-500/50 focus:ring-cyan-500/20'
                        }`}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-xs text-red-400 font-mono ml-1">⚠ Keys do not match</p>
                    )}
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading || (!!confirmPassword && password !== confirmPassword)}
                    className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-cyan-600 to-green-600 p-px font-semibold text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50"
                  >
                    <div className="relative flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 transition-all group-hover:bg-transparent">
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Securing...
                        </span>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>Update Access Key</span>
                        </>
                      )}
                    </div>
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-6 flex justify-between items-center px-2">
          <div className="flex gap-2 items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
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