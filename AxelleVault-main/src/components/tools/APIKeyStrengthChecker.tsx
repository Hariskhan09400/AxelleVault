/**
 * ============================================================
 * Advanced API Key Security Analyzer
 * Production-grade React + TypeScript component
 * 
 * Features:
 *  - Shannon entropy-based strength scoring
 *  - Pattern detection (sequential, repeated, keyboard, dictionary)
 *  - API key format detection (AWS, Google, Stripe, GitHub, etc.)
 *  - HaveIBeenPwned k-anonymity breach check (SHA-1 prefix)
 *  - Risk scoring (0–100) with actionable suggestions
 *  - Privacy-first: only first 4 chars ever logged
 *  - Real-time analysis with debounce
 *  - Cybersecurity-grade dark UI
 * ============================================================
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, logToolUsage } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface PatternResult {
  hasSequential: boolean;
  hasRepeated: boolean;
  hasKeyboard: boolean;
  hasDictionary: boolean;
  detectedPatterns: string[];
}

interface KeyFormat {
  detected: boolean;
  type: string;
  provider: string;
  isLive: boolean;
}

interface AnalysisResult {
  entropy: number;
  charsetSize: number;
  bitsPerChar: number;
  simulatedZxcvbnScore: number;   // 0–4 like zxcvbn (computed locally)
  estimatedCrackTime: string;
  patterns: PatternResult;
  format: KeyFormat;
  riskScore: number;              // 0–100 (lower = better)
  strengthLabel: string;
  strengthColor: string;
  warnings: string[];
  suggestions: string[];
  breached: boolean | null;       // null = not checked yet
  maskedKey: string;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const KEYBOARD_PATTERNS = [
  'qwerty','qwertyuiop','asdf','asdfgh','asdfghjkl',
  'zxcv','zxcvbn','1qaz','2wsx','3edc','qazwsx',
  '1234','12345','123456','1234567','12345678','123456789','1234567890',
  'abcd','abcde','abcdef',
];

const DICTIONARY_WORDS = [
  'password','admin','api','key','secret','token','auth','access',
  'login','root','user','test','demo','prod','staging','dev',
  'master','main','default','public','private','open','read','write',
  'temp','backup','sample','example','dummy','foobar','hello','world',
];

// ─────────────────────────────────────────────
// HELPER: SHA-1 (browser native via SubtleCrypto)
// ─────────────────────────────────────────────

async function sha1Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

// ─────────────────────────────────────────────
// HELPER: Entropy Calculation
// ─────────────────────────────────────────────

function calculateEntropy(value: string): { entropy: number; charsetSize: number; bitsPerChar: number } {
  let charsetSize = 0;
  if (/[a-z]/.test(value)) charsetSize += 26;
  if (/[A-Z]/.test(value)) charsetSize += 26;
  if (/[0-9]/.test(value)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(value)) charsetSize += 32; // printable symbols estimate

  const bitsPerChar = charsetSize > 0 ? Math.log2(charsetSize) : 0;
  const entropy = Math.round(value.length * bitsPerChar * 10) / 10;

  return { entropy, charsetSize, bitsPerChar: Math.round(bitsPerChar * 10) / 10 };
}

// ─────────────────────────────────────────────
// HELPER: Simulated zxcvbn Score (0–4)
// Maps entropy ranges + pattern penalties to a 0–4 score like zxcvbn
// ─────────────────────────────────────────────

function simulateZxcvbnScore(entropy: number, patterns: PatternResult): number {
  let score = 0;
  if (entropy >= 80) score = 4;
  else if (entropy >= 60) score = 3;
  else if (entropy >= 40) score = 2;
  else if (entropy >= 20) score = 1;
  else score = 0;

  // Pattern penalties
  const penaltyCount = [
    patterns.hasSequential,
    patterns.hasRepeated,
    patterns.hasKeyboard,
    patterns.hasDictionary,
  ].filter(Boolean).length;

  return Math.max(0, score - Math.floor(penaltyCount / 2)) as 0 | 1 | 2 | 3 | 4;
}

// ─────────────────────────────────────────────
// HELPER: Crack Time Estimator
// Based on entropy bits, assumes 10^12 guesses/sec (modern GPU farm)
// ─────────────────────────────────────────────

function estimateCrackTime(entropy: number): string {
  const guessesPerSecond = 1e12; // 1 trillion/sec
  const combinations = Math.pow(2, entropy);
  const seconds = combinations / guessesPerSecond / 2; // avg half keyspace

  if (seconds < 1) return 'Instantly';
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 31536000) return `${Math.round(seconds / 86400)} days`;
  if (seconds < 3.15e9) return `${Math.round(seconds / 31536000)} years`;
  if (seconds < 3.15e12) return `${Math.round(seconds / 3.15e9)} thousand years`;
  if (seconds < 3.15e15) return `${Math.round(seconds / 3.15e12)} million years`;
  return 'Centuries (safe)';
}

// ─────────────────────────────────────────────
// HELPER: Pattern Detection
// ─────────────────────────────────────────────

function detectPatterns(value: string): PatternResult {
  const lower = value.toLowerCase();
  const detectedPatterns: string[] = [];

  // Sequential characters (e.g., abcde, 12345)
  let sequentialCount = 0;
  for (let i = 1; i < value.length; i++) {
    if (value.charCodeAt(i) - value.charCodeAt(i - 1) === 1) {
      sequentialCount++;
      if (sequentialCount >= 3) break;
    } else {
      sequentialCount = 0;
    }
  }
  const hasSequential = sequentialCount >= 3;
  if (hasSequential) detectedPatterns.push('Sequential characters detected');

  // Repeated characters (e.g., aaaa, 1111)
  const hasRepeated = /(.)\1{3,}/.test(value);
  if (hasRepeated) detectedPatterns.push('Repeated character runs detected');

  // Keyboard patterns
  const hasKeyboard = KEYBOARD_PATTERNS.some(p => lower.includes(p));
  if (hasKeyboard) detectedPatterns.push('Keyboard walk pattern detected');

  // Dictionary words
  const hasDictionary = DICTIONARY_WORDS.some(w => lower.includes(w));
  if (hasDictionary) detectedPatterns.push('Common dictionary word found');

  return { hasSequential, hasRepeated, hasKeyboard, hasDictionary, detectedPatterns };
}

// ─────────────────────────────────────────────
// HELPER: API Key Format Detection
// ─────────────────────────────────────────────

function detectKeyFormat(value: string): KeyFormat {
  // AWS Access Key
  if (/^AKIA[0-9A-Z]{16}$/.test(value)) {
    return { detected: true, type: 'AWS Access Key ID', provider: 'Amazon Web Services', isLive: true };
  }
  // AWS Secret (40 chars base64-ish)
  if (/^[A-Za-z0-9/+=]{40}$/.test(value) && value.length === 40) {
    return { detected: true, type: 'Possible AWS Secret Access Key', provider: 'Amazon Web Services', isLive: true };
  }
  // Google API Key
  if (/^AIza[0-9A-Za-z_-]{35}$/.test(value)) {
    return { detected: true, type: 'Google API Key', provider: 'Google Cloud', isLive: true };
  }
  // Google OAuth
  if (/^ya29\.[0-9A-Za-z_-]+$/.test(value)) {
    return { detected: true, type: 'Google OAuth Token', provider: 'Google', isLive: true };
  }
  // Stripe live secret
  if (/^sk_live_[0-9a-zA-Z]{24,}$/.test(value)) {
    return { detected: true, type: 'Stripe Live Secret Key', provider: 'Stripe', isLive: true };
  }
  // Stripe test secret
  if (/^sk_test_[0-9a-zA-Z]{24,}$/.test(value)) {
    return { detected: true, type: 'Stripe Test Secret Key', provider: 'Stripe', isLive: false };
  }
  // Stripe publishable
  if (/^pk_(live|test)_[0-9a-zA-Z]{24,}$/.test(value)) {
    return { detected: true, type: 'Stripe Publishable Key', provider: 'Stripe', isLive: value.includes('pk_live_') };
  }
  // GitHub Personal Access Token (classic)
  if (/^ghp_[A-Za-z0-9]{36}$/.test(value)) {
    return { detected: true, type: 'GitHub Personal Access Token', provider: 'GitHub', isLive: true };
  }
  // GitHub Fine-grained
  if (/^github_pat_[A-Za-z0-9_]{82}$/.test(value)) {
    return { detected: true, type: 'GitHub Fine-Grained PAT', provider: 'GitHub', isLive: true };
  }
  // Anthropic
  if (/^sk-ant-[A-Za-z0-9_-]{95,}$/.test(value)) {
    return { detected: true, type: 'Anthropic API Key', provider: 'Anthropic', isLive: true };
  }
  // OpenAI
  if (/^sk-[A-Za-z0-9]{48}$/.test(value)) {
    return { detected: true, type: 'OpenAI API Key', provider: 'OpenAI', isLive: true };
  }
  // Slack Bot Token
  if (/^xoxb-[0-9]+-[0-9]+-[0-9A-Za-z]+$/.test(value)) {
    return { detected: true, type: 'Slack Bot Token', provider: 'Slack', isLive: true };
  }
  // Twilio
  if (/^SK[0-9a-fA-F]{32}$/.test(value)) {
    return { detected: true, type: 'Twilio API Key', provider: 'Twilio', isLive: true };
  }
  // Sendgrid
  if (/^SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/.test(value)) {
    return { detected: true, type: 'SendGrid API Key', provider: 'Twilio SendGrid', isLive: true };
  }

  return { detected: false, type: 'Generic / Unknown', provider: 'Unknown', isLive: false };
}

// ─────────────────────────────────────────────
// HELPER: Risk Score (0–100, lower = better)
// ─────────────────────────────────────────────

function calculateRiskScore(
  entropy: number,
  patterns: PatternResult,
  length: number,
  format: KeyFormat,
): number {
  let risk = 100;

  // Entropy reduction
  risk -= Math.min(50, entropy / 3);

  // Length reduction
  if (length >= 32) risk -= 20;
  else if (length >= 20) risk -= 10;
  else if (length >= 12) risk -= 5;

  // Pattern penalties
  if (patterns.hasSequential) risk += 10;
  if (patterns.hasRepeated) risk += 15;
  if (patterns.hasKeyboard) risk += 15;
  if (patterns.hasDictionary) risk += 20;

  // Format bonus (known format = properly generated)
  if (format.detected) risk -= 10;

  return Math.max(0, Math.min(100, Math.round(risk)));
}

// ─────────────────────────────────────────────
// HELPER: Suggestions Generator
// ─────────────────────────────────────────────

function generateSuggestions(
  length: number,
  entropy: number,
  patterns: PatternResult,
  charsetSize: number,
): string[] {
  const suggestions: string[] = [];

  if (length < 32) suggestions.push('Increase key length to at least 32 characters');
  if (length < 20) suggestions.push('Critically short — minimum 20 characters required');
  if (charsetSize < 62) suggestions.push('Mix uppercase, lowercase, numbers, and symbols');
  if (!(/[^a-zA-Z0-9]/.test(''))) suggestions.push('Add special characters (!@#$%^&*) to expand character set');
  if (patterns.hasSequential) suggestions.push('Avoid sequential characters like "1234" or "abcd"');
  if (patterns.hasRepeated) suggestions.push('Remove repeated character runs like "aaaa" or "1111"');
  if (patterns.hasKeyboard) suggestions.push('Avoid keyboard walk patterns like "qwerty" or "asdf"');
  if (patterns.hasDictionary) suggestions.push('Remove dictionary words like "password", "admin", "api"');
  if (entropy < 60) suggestions.push('Use a cryptographically secure random generator (e.g., crypto.randomBytes)');
  if (entropy < 40) suggestions.push('This key is dangerously weak — regenerate immediately');

  if (suggestions.length === 0) suggestions.push('Key looks strong — ensure it is rotated periodically');

  return suggestions;
}

// ─────────────────────────────────────────────
// HELPER: Strength Label + Color
// ─────────────────────────────────────────────

function getStrengthMeta(score: number): { label: string; color: string; barColor: string } {
  if (score === 4) return { label: 'Very Strong', color: '#00ff88', barColor: '#00ff88' };
  if (score === 3) return { label: 'Strong', color: '#7fff00', barColor: '#7fff00' };
  if (score === 2) return { label: 'Moderate', color: '#ffcc00', barColor: '#ffcc00' };
  if (score === 1) return { label: 'Weak', color: '#ff6600', barColor: '#ff6600' };
  return { label: 'Very Weak', color: '#ff2244', barColor: '#ff2244' };
}

// ─────────────────────────────────────────────
// HELPER: HaveIBeenPwned k-anonymity check
// Sends only first 5 chars of SHA-1 hash — never the full key
// ─────────────────────────────────────────────

async function checkHIBP(value: string): Promise<boolean> {
  try {
    const hash = await sha1Hex(value);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) return false;
    const text = await res.text();
    return text.split('\n').some(line => line.split(':')[0] === suffix);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// HELPER: Mask key for logging (first 4 + ***)
// ─────────────────────────────────────────────

function maskKey(value: string): string {
  if (value.length <= 4) return '****';
  return value.slice(0, 4) + '*'.repeat(Math.min(value.length - 4, 12)) + '...';
}

// ─────────────────────────────────────────────
// MAIN: Full Analysis Pipeline
// ─────────────────────────────────────────────

async function analyzeKey(value: string, checkBreaches: boolean): Promise<AnalysisResult> {
  const { entropy, charsetSize, bitsPerChar } = calculateEntropy(value);
  const patterns = detectPatterns(value);
  const format = detectKeyFormat(value);
  const simulatedZxcvbnScore = simulateZxcvbnScore(entropy, patterns);
  const estimatedCrackTime = estimateCrackTime(entropy);
  const riskScore = calculateRiskScore(entropy, patterns, value.length, format);
  const { label: strengthLabel, color: strengthColor } = getStrengthMeta(simulatedZxcvbnScore);
  const suggestions = generateSuggestions(value.length, entropy, patterns, charsetSize);

  const warnings: string[] = [];
  if (format.detected && format.isLive) {
    warnings.push(`⚠️ LIVE ${format.provider} key detected — never share or commit this`);
  }
  if (riskScore > 70) warnings.push('🔴 High risk key — replace immediately');
  if (patterns.hasDictionary) warnings.push('🚨 Contains common dictionary word — highly predictable');
  if (value.length < 16) warnings.push('🔴 Key too short for production use');

  let breached: boolean | null = null;
  if (checkBreaches) {
    breached = await checkHIBP(value);
    if (breached) warnings.push('🔥 This exact value appears in known data breach databases');
  }

  return {
    entropy,
    charsetSize,
    bitsPerChar,
    simulatedZxcvbnScore,
    estimatedCrackTime,
    patterns,
    format,
    riskScore,
    strengthLabel,
    strengthColor,
    warnings,
    suggestions,
    breached,
    maskedKey: maskKey(value),
  };
}

// ─────────────────────────────────────────────
// UI SUB-COMPONENTS
// ─────────────────────────────────────────────

const ScoreBar = ({ score, color }: { score: number; color: string }) => (
  <div style={{ background: '#1a1f2e', borderRadius: 6, height: 8, width: '100%', overflow: 'hidden', marginTop: 4 }}>
    <div style={{
      height: '100%',
      width: `${score}%`,
      background: color,
      borderRadius: 6,
      transition: 'width 0.5s ease, background 0.4s ease',
      boxShadow: `0 0 8px ${color}88`,
    }} />
  </div>
);

const Badge = ({ text, color }: { text: string; color: string }) => (
  <span style={{
    display: 'inline-block',
    background: `${color}22`,
    border: `1px solid ${color}66`,
    color,
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 4,
    fontFamily: 'monospace',
    fontWeight: 700,
    letterSpacing: 0.5,
  }}>{text}</span>
);

const MetricCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div style={{
    background: '#0d1117',
    border: '1px solid #1e2a3a',
    borderRadius: 8,
    padding: '10px 14px',
    flex: '1 1 120px',
    minWidth: 100,
  }}>
    <div style={{ color: '#4a6fa5', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
    <div style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>{value}</div>
    {sub && <div style={{ color: '#4a6fa5', fontSize: 10, marginTop: 2 }}>{sub}</div>}
  </div>
);

const ZxcvbnDots = ({ score }: { score: number }) => {
  const colors = ['#ff2244', '#ff6600', '#ffcc00', '#7fff00', '#00ff88'];
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          width: 28,
          height: 6,
          borderRadius: 3,
          background: i <= score ? colors[score] : '#1e2a3a',
          boxShadow: i <= score ? `0 0 6px ${colors[score]}88` : 'none',
          transition: 'background 0.3s ease',
        }} />
      ))}
      <span style={{ color: colors[score], fontSize: 11, fontFamily: 'monospace', fontWeight: 700, marginLeft: 4 }}>
        {['Very Weak', 'Weak', 'Moderate', 'Strong', 'Very Strong'][score]}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export const APIKeyStrengthChecker = () => {
  const { user } = useAuth();
  const [key, setKey] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkBreaches, setCheckBreaches] = useState(false);
  const [doNotStore, setDoNotStore] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [hibpChecking, setHibpChecking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real-time debounced analysis (no HIBP on live — only on button press)
  useEffect(() => {
    if (!key) { setResult(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const r = await analyzeKey(key, false);
      setResult(r);
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [key]);

  // Full analysis with optional HIBP check (on button press)
  const handleEvaluate = useCallback(async () => {
    if (!key) return;
    setLoading(true);
    if (checkBreaches) setHibpChecking(true);
    const r = await analyzeKey(key, checkBreaches);
    setHibpChecking(false);
    setResult(r);
    setLoading(false);

    // Supabase logging — NEVER log full key
    if (user && !doNotStore) {
      try {
        await logToolUsage(user.id, 'api-key-strength-checker', r.maskedKey, JSON.stringify({
          entropy: r.entropy,
          strength: r.strengthLabel,
          riskScore: r.riskScore,
          formatDetected: r.format.type,
          patternsFound: r.patterns.detectedPatterns,
          breached: r.breached,
        }));
        await supabase.from('security_logs').insert({
          user_id: user.id,
          event_type: 'apikey_strength_check',
          event_data: {
            key: r.maskedKey,         // ← only masked version
            strength: r.strengthLabel,
            riskScore: r.riskScore,
            entropy: r.entropy,
            formatType: r.format.type,
          },
          risk_level: r.riskScore > 70 ? 'high' : r.riskScore > 40 ? 'medium' : 'low',
        });
      } catch (e) {
        console.error('[APIKeyChecker] Supabase log failed:', e);
      }
    }
  }, [key, checkBreaches, doNotStore, user]);

  const riskColor = result
    ? result.riskScore > 70 ? '#ff2244'
    : result.riskScore > 40 ? '#ffcc00'
    : '#00ff88'
    : '#4a6fa5';

  return (
    <div style={{
      background: 'linear-gradient(145deg, #080d14 0%, #0d1520 100%)',
      border: '1px solid #1a2d45',
      borderRadius: 16,
      padding: '28px 32px',
      fontFamily: "'Fira Code', 'Courier New', monospace",
      maxWidth: 760,
      margin: '0 auto',
      boxShadow: '0 0 40px #00aaff18, 0 4px 32px #00000088',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background grid decoration */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'radial-gradient(circle at 1px 1px, #1a2d4522 1px, transparent 0)',
        backgroundSize: '32px 32px',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ marginBottom: 24, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>🛡️</span>
          <h3 style={{ color: '#00ccff', fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: 1 }}>
            API KEY SECURITY ANALYZER
          </h3>
          <Badge text="v2.0" color="#00ccff" />
        </div>
        <p style={{ color: '#4a6fa5', fontSize: 11, margin: 0 }}>
          Entropy analysis • Pattern detection • Breach checking • Format recognition
        </p>
      </div>

      {/* Input */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          type={showKey ? 'text' : 'password'}
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="Paste your API key here..."
          style={{
            width: '100%',
            background: '#0a0f1a',
            border: `1px solid ${result ? result.strengthColor + '66' : '#1e2a3a'}`,
            borderRadius: 8,
            padding: '12px 100px 12px 14px',
            color: '#e2e8f0',
            fontSize: 13,
            fontFamily: 'monospace',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.3s ease',
          }}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          onClick={() => setShowKey(s => !s)}
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'transparent', border: 'none', color: '#4a6fa5',
            fontSize: 11, cursor: 'pointer', padding: '4px 8px',
            fontFamily: 'monospace',
          }}
        >{showKey ? '[ HIDE ]' : '[ SHOW ]'}</button>
      </div>

      {/* Options row */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={checkBreaches}
            onChange={e => setCheckBreaches(e.target.checked)}
            style={{ accentColor: '#00ccff' }}
          />
          <span style={{ color: '#7a9bbf', fontSize: 11 }}>
            Check HaveIBeenPwned{' '}
            <span style={{ color: '#2a4a6f' }}>(k-anonymity — sends only 5 SHA-1 chars)</span>
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={doNotStore}
            onChange={e => setDoNotStore(e.target.checked)}
            style={{ accentColor: '#ff6600' }}
          />
          <span style={{ color: '#7a9bbf', fontSize: 11 }}>Do not store analysis results</span>
        </label>
      </div>

      {/* Evaluate button */}
      <button
        disabled={!key || loading}
        onClick={handleEvaluate}
        style={{
          background: key ? 'linear-gradient(90deg, #004466, #006699)' : '#1a2030',
          border: `1px solid ${key ? '#00aaff66' : '#1e2a3a'}`,
          color: key ? '#00ddff' : '#2a4a6f',
          padding: '10px 24px',
          borderRadius: 6,
          fontFamily: 'monospace',
          fontSize: 13,
          fontWeight: 700,
          cursor: key && !loading ? 'pointer' : 'not-allowed',
          letterSpacing: 1,
          transition: 'all 0.2s ease',
          marginBottom: 24,
        }}
      >
        {loading ? '[ ANALYZING... ]' : hibpChecking ? '[ CHECKING BREACHES... ]' : '[ RUN FULL ANALYSIS ]'}
      </button>

      {/* Results */}
      {result && (
        <div style={{ position: 'relative' }}>
          {/* Strength bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ color: '#4a6fa5', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Overall Strength</span>
              <span style={{ color: result.strengthColor, fontWeight: 700, fontSize: 13 }}>{result.strengthLabel}</span>
            </div>
            <ScoreBar score={(result.simulatedZxcvbnScore / 4) * 100} color={result.strengthColor} />
            <ZxcvbnDots score={result.simulatedZxcvbnScore} />
          </div>

          {/* Metric cards */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <MetricCard label="Entropy" value={`${result.entropy} bits`} sub={`${result.bitsPerChar} bits/char`} />
            <MetricCard label="Charset Size" value={result.charsetSize} sub="possible chars" />
            <MetricCard label="Crack Time" value={result.estimatedCrackTime} sub="GPU farm estimate" />
            <MetricCard
              label="Risk Score"
              value={`${result.riskScore}/100`}
              sub={result.riskScore > 70 ? 'HIGH RISK' : result.riskScore > 40 ? 'MEDIUM' : 'LOW RISK'}
            />
          </div>

          {/* Risk score bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#4a6fa5', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Risk Level</span>
              <span style={{ color: riskColor, fontSize: 10 }}>{result.riskScore > 70 ? '🔴 HIGH' : result.riskScore > 40 ? '🟡 MEDIUM' : '🟢 LOW'}</span>
            </div>
            <ScoreBar score={result.riskScore} color={riskColor} />
          </div>

          {/* Format Detection */}
          <div style={{ background: '#0d1117', border: '1px solid #1e2a3a', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ color: '#4a6fa5', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Format Detection</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge
                text={result.format.detected ? '✓ DETECTED' : '? UNKNOWN FORMAT'}
                color={result.format.detected ? '#00ff88' : '#4a6fa5'}
              />
              <span style={{ color: '#e2e8f0', fontSize: 12 }}>{result.format.type}</span>
              {result.format.detected && (
                <Badge
                  text={result.format.isLive ? '🔴 LIVE KEY' : '🟡 TEST KEY'}
                  color={result.format.isLive ? '#ff2244' : '#ffcc00'}
                />
              )}
            </div>
            {result.format.detected && (
              <div style={{ color: '#4a6fa5', fontSize: 11, marginTop: 6 }}>
                Provider: <span style={{ color: '#7ab3d4' }}>{result.format.provider}</span>
              </div>
            )}
          </div>

          {/* Pattern Detection */}
          <div style={{ background: '#0d1117', border: '1px solid #1e2a3a', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ color: '#4a6fa5', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Pattern Analysis</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {[
                { label: 'Sequential', active: result.patterns.hasSequential },
                { label: 'Repeated', active: result.patterns.hasRepeated },
                { label: 'Keyboard Walk', active: result.patterns.hasKeyboard },
                { label: 'Dictionary Word', active: result.patterns.hasDictionary },
              ].map(({ label, active }) => (
                <Badge key={label} text={`${active ? '✗' : '✓'} ${label}`} color={active ? '#ff2244' : '#00ff88'} />
              ))}
            </div>
            {result.patterns.detectedPatterns.length > 0 && (
              <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                {result.patterns.detectedPatterns.map(p => (
                  <li key={p} style={{ color: '#ff6655', fontSize: 11, marginBottom: 2 }}>{p}</li>
                ))}
              </ul>
            )}
          </div>

          {/* HIBP Result */}
          {result.breached !== null && (
            <div style={{
              background: result.breached ? '#1a0810' : '#0a1a10',
              border: `1px solid ${result.breached ? '#ff224466' : '#00ff8866'}`,
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>{result.breached ? '🔥' : '✅'}</span>
              <div>
                <div style={{ color: result.breached ? '#ff4466' : '#00ff88', fontSize: 12, fontWeight: 700 }}>
                  {result.breached ? 'Found in known breach databases!' : 'Not found in breach databases'}
                </div>
                <div style={{ color: '#4a6fa5', fontSize: 10 }}>
                  Via HaveIBeenPwned k-anonymity API (SHA-1 prefix only — key never sent)
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#4a6fa5', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Security Warnings</div>
              {result.warnings.map(w => (
                <div key={w} style={{
                  background: '#1a1008',
                  border: '1px solid #ff660033',
                  borderRadius: 6,
                  padding: '7px 12px',
                  marginBottom: 6,
                  color: '#ffaa44',
                  fontSize: 11,
                }}>{w}</div>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <div>
              <div style={{ color: '#4a6fa5', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Recommendations</div>
              {result.suggestions.map(s => (
                <div key={s} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginBottom: 6,
                }}>
                  <span style={{ color: '#00ccff', fontSize: 11, marginTop: 1 }}>›</span>
                  <span style={{ color: '#7ab3d4', fontSize: 11 }}>{s}</span>
                </div>
              ))}
            </div>
          )}

          {/* Privacy footer */}
          <div style={{
            marginTop: 20,
            padding: '8px 14px',
            background: '#070c14',
            borderRadius: 6,
            border: '1px solid #0d1a2a',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 12 }}>🔒</span>
            <span style={{ color: '#2a4a6f', fontSize: 10 }}>
              Privacy: Full key never logged. Only stored: <code style={{ color: '#3a6a8f' }}>{result.maskedKey}</code>
              {doNotStore && <span style={{ color: '#ff6600', marginLeft: 8 }}>— Storage disabled by user</span>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
