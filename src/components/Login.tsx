import { useState, useEffect } from 'react';
import {
  Shield, Mail, Lock, Eye, EyeOff, AlertCircle,
  ArrowRight, Fingerprint, Check
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { hasSupabaseEnv } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────
type Mode = 'login' | 'signup';

interface LoginProps {
  onToggleMode: () => void;
  onForgotPassword: () => void;
}

// ─── Animated background grid ─────────────────────────────
const CyberGrid = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    <div style={{
      position: 'absolute', inset: 0,
      backgroundImage: `
        linear-gradient(rgba(34,211,238,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(34,211,238,0.03) 1px, transparent 1px)
      `,
      backgroundSize: '40px 40px',
    }} />
    <div style={{
      position: 'absolute', top: '-20%', left: '-10%',
      width: '50%', height: '50%',
      background: 'radial-gradient(ellipse, rgba(6,182,212,0.08) 0%, transparent 70%)',
      animation: 'pulse 8s ease-in-out infinite',
    }} />
    <div style={{
      position: 'absolute', bottom: '-20%', right: '-10%',
      width: '50%', height: '50%',
      background: 'radial-gradient(ellipse, rgba(16,185,129,0.06) 0%, transparent 70%)',
      animation: 'pulse 10s ease-in-out infinite 2s',
    }} />
    <style>{`
      @keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
    `}</style>
  </div>
);

// ─── Radar Orb ─────────────────────────────────────────────
const RadarOrb = () => (
  <div className="relative w-full h-64 flex items-center justify-center">
    <style>{`
      @keyframes spin-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      @keyframes orbit1 { from{transform:rotate(0deg) translateX(90px) rotate(0deg)} to{transform:rotate(360deg) translateX(90px) rotate(-360deg)} }
      @keyframes orbit2 { from{transform:rotate(180deg) translateX(120px) rotate(-180deg)} to{transform:rotate(540deg) translateX(120px) rotate(-540deg)} }
      @keyframes orbit3 { from{transform:rotate(90deg) translateX(60px) rotate(-90deg)} to{transform:rotate(450deg) translateX(60px) rotate(-450deg)} }
      @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      @keyframes ring-pulse { 0%,100%{opacity:0.15} 50%{opacity:0.35} }
      @keyframes scan { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
    `}</style>

    {/* Rings */}
    {[200, 150, 100].map((size, i) => (
      <div key={i} className="absolute rounded-full border border-cyan-400/20"
        style={{ width: size, height: size, animation: `ring-pulse ${3+i}s ease-in-out infinite`, animationDelay: `${i*0.5}s` }} />
    ))}

    {/* Scan beam */}
    <div className="absolute w-[150px] h-[150px] rounded-full overflow-hidden"
      style={{ animation: 'scan 4s linear infinite' }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: '50%', height: '50%',
        background: 'conic-gradient(from 0deg, transparent, rgba(34,211,238,0.2) 60deg, transparent 60deg)',
        transformOrigin: '0 0',
      }} />
    </div>

    {/* Center shield */}
    <div style={{ animation: 'float 3s ease-in-out infinite', position: 'relative', zIndex: 10 }}>
      <div className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle, rgba(6,182,212,0.3), rgba(6,182,212,0.05))',
          border: '1px solid rgba(34,211,238,0.5)',
          boxShadow: '0 0 30px rgba(34,211,238,0.4), 0 0 60px rgba(34,211,238,0.15)',
        }}>
        <Shield className="w-8 h-8 text-cyan-300" />
      </div>
    </div>

    {/* Orbiting nodes */}
    {[
      { emoji: '🔐', anim: 'orbit1', dur: '6s' },
      { emoji: '⚡', anim: 'orbit2', dur: '8s' },
      { emoji: '🛡️', anim: 'orbit3', dur: '5s' },
    ].map((n, i) => (
      <div key={i} className="absolute w-0 h-0"
        style={{ animation: `${n.anim} ${n.dur} linear infinite` }}>
        <div className="w-8 h-8 rounded-full bg-[#0a1628] border border-cyan-500/30 flex items-center justify-center text-xs"
          style={{ boxShadow: '0 0 10px rgba(34,211,238,0.2)' }}>
          {n.emoji}
        </div>
      </div>
    ))}

    {/* Stats bottom */}
    <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-4">
      {[['AES-256', '#22d3ee'], ['TLS 1.3', '#4ade80'], ['Secure', '#a78bfa']].map(([label, color]) => (
        <div key={label} className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-white/5 bg-black/30">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
          <span className="text-[9px] font-mono text-gray-400">{label}</span>
        </div>
      ))}
    </div>
  </div>
);

// ─── Password strength ─────────────────────────────────────
const getStrength = (p: string) => {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
};
const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const strengthColor = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];

// ═══════════════════════════════════════════════════════════
// LOGIN FORM
// ═══════════════════════════════════════════════════════════
const LoginForm = ({ onForgotPassword, onSwitchToSignup }: {
  onForgotPassword: () => void;
  onSwitchToSignup: () => void;
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem('av_remembered_email');
    if (saved) { setEmail(saved); setRememberMe(true); }
  }, []);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSupabaseEnv) { setError('Service not configured.'); return; }

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setError('');
    setLoading(true);

    if (rememberMe) localStorage.setItem('av_remembered_email', trimmedEmail);
    else localStorage.removeItem('av_remembered_email');

    const { error: authError } = await signIn(trimmedEmail, trimmedPassword);

    if (authError) {
      setError('Wrong email or password. Please try again.');
      showToast('error', 'Login failed. Check your credentials.');
    } else {
      showToast('success', 'Welcome back to AxelleVault!');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs animate-in shake duration-500">
          <AlertCircle className="w-4 h-4 flex-shrink-0 animate-pulse" /> {error}
        </div>
      )}

      {/* Email */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email Address</label>
        <div className="relative group">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)} required
            placeholder="your@email.com"
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all hover:border-white/20"
          />
          {email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center animate-pulse">
              <Check className="w-2.5 h-2.5 text-green-400" />
            </div>
          )}
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Password</label>
        <div className="relative group">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
          <input
            type={showPass ? 'text' : 'password'} value={password}
            onChange={e => setPassword(e.target.value)} required
            placeholder="Enter your password"
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all hover:border-white/20"
          />
          <button type="button" onClick={() => setShowPass(!showPass)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cyan-400 transition-colors duration-200">
            {showPass ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Remember me + Forgot */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none group">
          <div
            onClick={() => setRememberMe(!rememberMe)}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 ${rememberMe ? 'bg-cyan-500 border-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.3)]' : 'border-gray-600 hover:border-cyan-500/50 group-hover:border-cyan-500/50'}`}>
            {rememberMe && <svg className="w-2.5 h-2.5 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
          </div>
          <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">Remember me</span>
        </label>
        <button type="button" onClick={onForgotPassword}
          className="text-xs text-cyan-500 hover:text-cyan-300 transition-colors duration-200 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-cyan-400 after:transition-all hover:after:w-full">
          Forgot password?
        </button>
      </div>

      {/* Submit */}
      <button type="submit" disabled={loading}
        className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:scale-105 active:scale-95 duration-200 relative overflow-hidden group"
        style={{
          background: 'linear-gradient(135deg, #0891b2, #059669)',
          boxShadow: loading ? 'none' : '0 0 25px rgba(6,182,212,0.3)',
        }}>
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        <div className="relative z-10 flex items-center gap-2">
          {loading ? (
            <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Signing in...</>
          ) : (
            <><Fingerprint className="w-4 h-4" /> Sign In <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
          )}
        </div>
      </button>

      <p className="text-center text-xs text-gray-500">
        Don't have an account?{' '}
        <button type="button" onClick={onSwitchToSignup} className="text-cyan-400 font-semibold hover:text-cyan-300 transition-colors duration-200 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-cyan-300 after:transition-all hover:after:w-full">
          Create one →
        </button>
      </p>
    </form>
  );
};

// ═══════════════════════════════════════════════════════════
// SIGNUP FORM
// ═══════════════════════════════════════════════════════════
const SignupForm = ({ onSwitchToLogin }: { onSwitchToLogin: () => void }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();
  const { showToast } = useToast();
  const strength = getStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSupabaseEnv) { setError('Service not configured.'); return; }

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedUsername || !trimmedEmail || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setError('');
    setLoading(true);

    const { error: authError } = await signUp(trimmedEmail, password, trimmedUsername);

    if (authError) {
      setError(authError.message ?? 'Something went wrong. Please try again.');
      showToast('error', 'Account creation failed.');
    } else {
      setSuccess(true);
      showToast('success', 'Account created! Please sign in.');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="text-center py-6 space-y-5 animate-in fade-in duration-500">
        <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto animate-pulse">
          <Check className="w-8 h-8 text-green-400" />
        </div>
        <div>
          <h3 className="text-white font-bold text-lg mb-1">Account Created!</h3>
          <p className="text-gray-400 text-sm">Your account is ready. Please sign in to continue.</p>
        </div>
        <button
          onClick={onSwitchToLogin}
          className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 duration-200 relative overflow-hidden group"
          style={{ background: 'linear-gradient(135deg, #0891b2, #059669)', boxShadow: '0 0 25px rgba(6,182,212,0.3)' }}>
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          <div className="relative z-10 flex items-center gap-2">
            <Fingerprint className="w-4 h-4" /> Sign In Now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs animate-in shake duration-500">
          <AlertCircle className="w-4 h-4 flex-shrink-0 animate-pulse" /> {error}
        </div>
      )}

      {/* Username */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Username</label>
        <div className="relative group">
          <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
          <input
            type="text" value={username} onChange={e => setUsername(e.target.value)} required
            placeholder="Choose a username"
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all hover:border-white/20"
          />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email Address</label>
        <div className="relative group">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)} required
            placeholder="your@email.com"
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all hover:border-white/20"
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Password</label>
        <div className="relative group">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
          <input
            type={showPass ? 'text' : 'password'} value={password}
            onChange={e => setPassword(e.target.value)} required
            placeholder="Min. 8 characters"
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all hover:border-white/20"
          />
          <button type="button" onClick={() => setShowPass(!showPass)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cyan-400 transition-colors duration-200">
            {showPass ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
        {/* Strength bar */}
        {password && (
          <div className="space-y-1 animate-in fade-in duration-300">
            <div className="flex gap-1">
              {[0,1,2,3].map(i => (
                <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                  style={{ backgroundColor: i < strength ? strengthColor[strength] : '#1f2937' }} />
              ))}
            </div>
            <p className="text-[10px] font-mono font-semibold transition-colors duration-300" style={{ color: strengthColor[strength] || '#6b7280' }}>
              {strength > 0 ? `${strengthLabel[strength]} password` : 'Too weak'}
            </p>
          </div>
        )}
      </div>

      {/* Submit */}
      <button type="submit" disabled={loading}
        className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:scale-105 active:scale-95 duration-200 relative overflow-hidden group"
        style={{
          background: 'linear-gradient(135deg, #0891b2, #059669)',
          boxShadow: loading ? 'none' : '0 0 25px rgba(6,182,212,0.3)',
        }}>
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        <div className="relative z-10 flex items-center gap-2">
          {loading ? (
            <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Creating account...</>
          ) : (
            <><Shield className="w-4 h-4" /> Create Account <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
          )}
        </div>
      </button>

      <p className="text-center text-xs text-gray-500">
        Already have an account?{' '}
        <button type="button" onClick={onSwitchToLogin} className="text-cyan-400 font-semibold hover:text-cyan-300 transition-colors duration-200 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-cyan-300 after:transition-all hover:after:w-full">
          Sign in →
        </button>
      </p>
    </form>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════
export const Login = ({ onForgotPassword, onToggleMode: _onToggleMode }: LoginProps) => {
  const [mode, setMode] = useState<Mode>('login');

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative">
      <CyberGrid />

      <style>{`
        @keyframes fade-in { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .fade-in { animation: fade-in 0.4s ease-out both; }
      `}</style>

      <div className="relative z-10 w-full max-w-4xl rounded-2xl overflow-hidden fade-in"
        style={{ boxShadow: '0 0 0 1px rgba(34,211,238,0.1), 0 40px 80px rgba(0,0,0,0.7)' }}>

        <div className="grid lg:grid-cols-2 min-h-[580px]">

          {/* ── LEFT: Visual ── */}
          <div className="hidden lg:flex flex-col items-center justify-center p-10 relative"
            style={{ background: 'linear-gradient(135deg, #020d1f, #031428, #020d1f)' }}>
            {/* Corner accents */}
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-cyan-500/40 rounded-tl-lg" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-green-500/40 rounded-br-lg" />

            {/* Logo */}
            <div className="absolute top-6 left-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.7))' }} />
              <span className="text-sm font-bold text-white tracking-tight">AxelleVault</span>
            </div>

            <RadarOrb />

            {/* Tagline */}
            <div className="absolute bottom-6 text-center">
              <p className="text-[9px] font-mono text-cyan-500/40 uppercase tracking-[0.2em]">
                Your security. Always on.
              </p>
            </div>

            {/* System status */}
            <div className="absolute top-6 right-6 text-right">
              <div className="flex items-center justify-end gap-1.5 mb-1">
                <span className="text-[9px] font-mono text-gray-600">SYSTEM</span>
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              </div>
              <p className="text-[9px] font-mono text-gray-600">ONLINE</p>
            </div>
          </div>

          {/* ── RIGHT: Form ── */}
          <div className="flex flex-col justify-center p-8 lg:p-10 bg-[#07111e]">

            {/* Mobile logo */}
            <div className="flex lg:hidden items-center gap-2 mb-8">
              <Shield className="w-6 h-6 text-cyan-400" />
              <span className="text-lg font-bold text-white">AxelleVault</span>
            </div>

            {/* Header */}
            <div className="mb-7">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-mono text-green-400 uppercase tracking-widest">Secure Connection Active</span>
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h1>
              <p className="text-sm text-gray-500">
                {mode === 'login'
                  ? 'Sign in to access your vault'
                  : 'Join AxelleVault — it only takes a minute'}
              </p>
            </div>

            {/* Mode tabs */}
            <div className="flex gap-1 bg-black/40 border border-white/8 rounded-xl p-1 mb-7">
              {(['login', 'signup'] as Mode[]).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 relative ${
                    mode === m
                      ? 'bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}>
                  {m === 'login' ? 'Sign In' : 'Sign Up'}
                  {mode === m && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-cyan-600 rounded-full" />}
                </button>
              ))}
            </div>

            {/* Forms */}
            {mode === 'login' ? (
              <LoginForm
                onForgotPassword={onForgotPassword}
                onSwitchToSignup={() => setMode('signup')}
              />
            ) : (
              <SignupForm onSwitchToLogin={() => setMode('login')} />
            )}

            {/* Footer */}
            <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
                <span className="text-[9px] text-gray-600 font-mono uppercase tracking-wider">Encrypted</span>
              </div>
              <span className="text-[9px] text-gray-700 font-mono">© 2026 AxelleVault</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;