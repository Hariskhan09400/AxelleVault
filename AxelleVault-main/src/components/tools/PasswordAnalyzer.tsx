import { useEffect, useState, useRef } from 'react';
import { Shield, AlertTriangle, Clock3, Sparkles, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { analyzePasswordStrength } from '../../utils/securityTools';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';

// ─── Animated strength bar ────────────────────────────────────────────────────
function StrengthMeter({ score }: { score: number }) {
  const segments = 5;
  const filled = Math.ceil((score / 100) * segments);
  const color =
    score >= 80 ? '#22d3ee' :
    score >= 60 ? '#38bdf8' :
    score >= 40 ? '#facc15' :
    score >= 20 ? '#fb923c' : '#f87171';
  const label =
    score >= 80 ? 'Excellent' :
    score >= 60 ? 'Strong' :
    score >= 40 ? 'Fair' :
    score >= 20 ? 'Weak' : 'Very Weak';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-white">Your password strength</span>
        <span className="text-sm font-bold" style={{ color }}>{label}</span>
      </div>
      <div className="flex gap-1.5 mb-2">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-2 rounded-full transition-all duration-500"
            style={{
              background: i < filled ? color : 'rgba(255,255,255,0.08)',
              boxShadow: i < filled ? `0 0 6px ${color}66` : 'none',
            }}
          />
        ))}
      </div>
      <div className="w-full bg-white/5 rounded-full h-0.5 mb-1">
        <div
          className="h-0.5 rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Character checklist ──────────────────────────────────────────────────────
function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok
        ? <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        : <XCircle className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
      <span className={`text-xs ${ok ? 'text-gray-300' : 'text-gray-500'}`}>{label}</span>
    </div>
  );
}

// ─── Animated crack-time counter ──────────────────────────────────────────────
function CrackTime({ crackTime }: { crackTime: string }) {
  const [display, setDisplay] = useState('0');
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let start: number | null = null;
    const duration = 600;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      // show scrambled chars then settle
      if (progress < 1) {
        const chars = '!@#$%0123456789abcdef';
        setDisplay(crackTime.split('').map((c, i) =>
          i / crackTime.length < progress ? c : chars[Math.floor(Math.random() * chars.length)]
        ).join(''));
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(crackTime);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [crackTime]);

  return <span className="font-mono text-lg font-bold text-white">{display}</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────
export const PasswordAnalyzer = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzePasswordStrength> | null>(null);

  useEffect(() => {
    if (!password) { setAnalysis(null); return; }
    setAnalysis(analyzePasswordStrength(password));
  }, [password]);

  const logAnalysis = async () => {
    if (!user || !analysis) return;
    await supabase.from('security_logs').insert({
      user_id: user.id,
      event_type: 'password_analyzed',
      event_data: { strength: analysis.strength, score: analysis.score, crackTime: analysis.crackTime },
      risk_level: analysis.score < 40 ? 'high' : analysis.score < 70 ? 'medium' : 'low',
    });
    showToast('info', `Password strength: ${analysis.strength} (${analysis.score}/100)`);
  };

  const hasUpper   = /[A-Z]/.test(password);
  const hasLower   = /[a-z]/.test(password);
  const hasNumber  = /[0-9]/.test(password);
  const hasSymbol  = /[^A-Za-z0-9]/.test(password);
  const hasLength  = password.length >= 14;

  const score = analysis?.score ?? 0;
  const accentColor =
    score >= 80 ? '#22d3ee' :
    score >= 60 ? '#38bdf8' :
    score >= 40 ? '#facc15' :
    score >= 20 ? '#fb923c' : '#f87171';

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
      style={{ background: 'linear-gradient(160deg, #0b1120 0%, #0d1829 60%, #091018 100%)' }}
    >
      {/* Subtle glow behind input */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-700"
        style={{
          opacity: password ? 0.18 : 0,
          background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${accentColor} 0%, transparent 70%)`,
        }}
      />

      <div className="relative z-10 p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-cyan-400" />
            <h3 className="text-3xl font-extrabold tracking-tight">
              <span className="text-white">Password </span>
              <span className="text-cyan-400">Strength</span>
              <span className="text-white"> Testing Tool</span>
            </h3>
          </div>
          <p className="text-gray-400 text-sm">Think you have a strong password? Find out below.</p>
        </div>

        {/* Input */}
        <div className="relative mb-6">
          <label className="absolute -top-2.5 left-4 text-xs text-gray-500 bg-transparent px-1 pointer-events-none">
            Evaluate your password:
          </label>
          <div
            className="relative rounded-xl overflow-hidden transition-all duration-300"
            style={{
              border: `1px solid ${password ? accentColor + '55' : 'rgba(255,255,255,0.1)'}`,
              boxShadow: password ? `0 0 0 3px ${accentColor}18, inset 0 0 30px rgba(0,0,0,0.4)` : 'inset 0 0 30px rgba(0,0,0,0.3)',
            }}
          >
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/5 px-5 py-5 text-white text-lg font-mono placeholder-white/10 focus:outline-none pr-14"
              placeholder="••••••••••••••••"
              autoComplete="new-password"
            />
            <button
              onClick={() => setShowPw(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Strength meter — always visible */}
        <div className="mb-6">
          <StrengthMeter score={score} />
        </div>

        {/* Results grid */}
        {analysis && password && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Crack time */}
              <div
                className="rounded-xl p-4 border border-white/5"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock3 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Estimated crack time</span>
                </div>
                <CrackTime crackTime={analysis.crackTime} />
              </div>

              {/* Entropy */}
              <div
                className="rounded-xl p-4 border border-white/5"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Entropy</span>
                </div>
                <span className="font-mono text-lg font-bold text-white">{analysis.entropy.toFixed(1)} bits</span>
              </div>
            </div>

            {/* Checklist */}
            <div
              className="rounded-xl p-4 border border-white/5 mb-4"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Requirements</p>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                <CheckRow ok={hasLength}  label="14+ characters" />
                <CheckRow ok={hasUpper}   label="Uppercase (A–Z)" />
                <CheckRow ok={hasLower}   label="Lowercase (a–z)" />
                <CheckRow ok={hasNumber}  label="Numbers (0–9)" />
                <CheckRow ok={hasSymbol}  label="Symbols (!@#$)" />
                <CheckRow ok={password.length >= 8} label="Minimum 8 chars" />
              </div>
            </div>

            {/* Feedback */}
            {analysis.feedback.length > 0 && (
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-yellow-400 mb-2 uppercase tracking-wide">Recommendations</p>
                    <ul className="space-y-1">
                      {analysis.feedback.map((item, i) => (
                        <li key={i} className="text-xs text-yellow-200/80">• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Tip */}
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 mb-5">
              <p className="flex items-center gap-2 text-xs text-cyan-300">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                Suggested baseline: 14+ chars, mixed case, numbers, and symbols.
              </p>
            </div>

            {/* Save button */}
            <button
              onClick={logAnalysis}
              className="w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 px-4 py-3 text-sm font-semibold text-cyan-300 transition-all duration-150"
            >
              Save Analysis to History
            </button>
          </>
        )}

        {/* Empty state */}
        {!password && (
          <div className="text-center py-6">
            <p className="text-gray-600 text-sm">Estimated time to crack : 0</p>
          </div>
        )}
      </div>
    </div>
  );
};