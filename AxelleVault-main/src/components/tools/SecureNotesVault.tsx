import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Shield, Lock, Unlock, Trash2, Plus, AlertTriangle, Eye, EyeOff,
  Settings, Copy, Check, Search, Star, StarOff, Download, Upload,
  Key, FileText, RefreshCw, ChevronDown, X, Zap,
} from 'lucide-react';

// ─── Platform Icons (SVG inline) ─────────────────────────────────────────────
const PLATFORM_ICONS: Record<string, { color: string; label: string; svg: string }> = {
  instagram: {
    color: '#E1306C', label: 'Instagram',
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>`,
  },
  facebook: {
    color: '#1877F2', label: 'Facebook',
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  twitter: {
    color: '#1DA1F2', label: 'Twitter/X',
    svg: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  },
  google: {
    color: '#EA4335', label: 'Google',
    svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`,
  },
  github: {
    color: '#333', label: 'GitHub',
    svg: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>`,
  },
  linkedin: {
    color: '#0A66C2', label: 'LinkedIn',
    svg: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>`,
  },
  snapchat: {
    color: '#FFFC00', label: 'Snapchat',
    svg: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.166 3C9.315 3 7 5.315 7 8.166v.871c-.318.14-.673.21-1.003.21-.22 0-.44-.03-.651-.089l-.068-.02-.068.02a.5.5 0 0 0-.332.612l.01.03c.155.48.55.83 1.037.946.008.002.016.003.024.005-.268.565-.674 1.058-1.18 1.42a.5.5 0 0 0 .079.874c.93.354 1.703.501 2.29.5.13 0 .254-.007.373-.02.455.617 1.261 1.147 2.663 1.397.022.004.044.008.066.013a3.24 3.24 0 0 1-.576 1.066c-.46.558-1.063.834-1.742.834-.222 0-.442-.035-.654-.103l-.052-.017-.052.017c-.316.105-.646.158-.977.158-.51 0-1.014-.138-1.457-.4a.5.5 0 0 0-.695.664c.614 1.016 1.691 1.63 2.848 1.63.454 0 .902-.1 1.32-.293A4.97 4.97 0 0 0 12 18.5a4.97 4.97 0 0 0 2.92-.938c.418.193.866.293 1.32.293 1.157 0 2.234-.614 2.848-1.63a.5.5 0 0 0-.695-.664c-.443.262-.947.4-1.457.4-.33 0-.66-.053-.977-.158l-.052-.017-.052.017c-.212.068-.432.103-.654.103-.679 0-1.282-.276-1.742-.834a3.24 3.24 0 0 1-.576-1.066c.022-.005.044-.009.066-.013 1.402-.25 2.208-.78 2.663-1.397.119.013.243.02.373.02.587.001 1.36-.146 2.29-.5a.5.5 0 0 0 .079-.874c-.506-.362-.912-.855-1.18-1.42.008-.002.016-.003.024-.005.487-.116.882-.466 1.037-.946l.01-.03a.5.5 0 0 0-.332-.612l-.068-.02-.068.02c-.211.059-.431.089-.651.089-.33 0-.685-.07-1.003-.21v-.871C17 5.315 14.685 3 11.834 3h.332z"/></svg>`,
  },
  youtube: {
    color: '#FF0000', label: 'YouTube',
    svg: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75,15.02 15.5,12 9.75,8.98 9.75,15.02" fill="white"/></svg>`,
  },
  whatsapp: {
    color: '#25D366', label: 'WhatsApp',
    svg: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>`,
  },
  netflix: {
    color: '#E50914', label: 'Netflix',
    svg: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.596 2.344.058 4.85.398 4.854.398-2.8-7.924-5.923-16.747-8.487-24zm8.489 0v9.63L18.6 23.976c-.101-7.502-.028-15.651 0-23.976zm-8.489 14.34v9.633h4.016V14.34z"/></svg>`,
  },
  amazon: {
    color: '#FF9900', label: 'Amazon',
    svg: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.699-3.182v.685zm3.186 7.705c-.209.189-.512.201-.745.074-1.052-.872-1.238-1.276-1.814-2.106-1.734 1.767-2.962 2.297-5.209 2.297-2.66 0-4.731-1.641-4.731-4.925 0-2.565 1.391-4.309 3.37-5.164 1.715-.754 4.11-.891 5.942-1.095v-.41c0-.753.06-1.642-.384-2.294-.385-.579-1.124-.82-1.775-.82-1.205 0-2.277.618-2.54 1.897-.054.285-.261.567-.549.582l-3.061-.333c-.259-.056-.548-.266-.472-.661C5.57 2.359 8.293 1.5 10.726 1.5c1.24 0 2.861.33 3.842 1.268 1.24 1.159 1.122 2.707 1.122 4.391v3.979c0 1.196.496 1.722 .963 2.369.163.231.199.505-.005.676l-1.504 1.612zm4.021 1.154c-1.494 1.049-3.663 1.572-5.523 1.572-2.614 0-4.967-.966-6.745-2.572-.14-.126-.015-.298.153-.2 1.921 1.117 4.292 1.789 6.744 1.789 1.654 0 3.473-.343 5.147-1.052.253-.107.466.166.224.463zm.638-1.964c-.191-.245-1.263-.116-1.744-.059-.147.019-.169-.11-.038-.202 .854-.6 2.257-.427 2.42-.226.163.204-.043 1.606-.845 2.277-.124.104-.242.049-.187-.087.18-.451.584-1.46.394-1.703z"/></svg>`,
  },
  spotify: {
    color: '#1DB954', label: 'Spotify',
    svg: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`,
  },
  custom: {
    color: '#06b6d4', label: 'Custom',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  },
};

const CATEGORIES = ['All', 'Social Media', 'Email', 'Banking', 'Shopping', 'Work', 'Entertainment', 'Other'];

const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'twitter', 'whatsapp', 'snapchat', 'youtube', 'linkedin'];
const EMAIL_PLATFORMS  = ['google'];
const ENT_PLATFORMS    = ['netflix', 'spotify', 'amazon'];
const WORK_PLATFORMS   = ['github', 'linkedin'];

// ─── Types ────────────────────────────────────────────────────────────────────
interface VaultEntry {
  id: string;
  platform: string;
  customName?: string;
  username: string;
  password: string; // encrypted (base64)
  iv: string;
  salt: string;
  category: string;
  notes?: string;
  url?: string;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SecureNote {
  id: string;
  title: string;
  content: string; // encrypted
  iv: string;
  salt: string;
  starred: boolean;
  createdAt: string;
}

interface VaultData {
  pinHash: string;
  entries: VaultEntry[];
  notes: SecureNote[];
  version: number;
}

// ─── Storage ──────────────────────────────────────────────────────────────────
const LS_KEY    = 'axelle_vault_v2';
const SS_PIN    = 'axelle_pin_session';

const loadVault = (): VaultData | null => {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; }
  catch { return null; }
};

const saveVault = (d: VaultData) => localStorage.setItem(LS_KEY, JSON.stringify(d));

const getVault = (): VaultData => loadVault() || { pinHash: '', entries: [], notes: [], version: 2 };

// ─── Crypto ───────────────────────────────────────────────────────────────────
const rnd = (n: number) => window.crypto.getRandomValues(new Uint8Array(n));
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const ub64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const genSalt = () => b64(rnd(16));
const genId   = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const deriveKey = async (pin: string, salt: string) => {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: ub64(salt), iterations: 100_000, hash: 'SHA-256' }, base, 256
  );
  return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
};

const encrypt = async (text: string, pin: string, salt: string) => {
  const key = await deriveKey(pin, salt);
  const iv  = rnd(12);
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { content: b64(enc), iv: b64(iv) };
};

const decrypt = async (content: string, iv: string, pin: string, salt: string): Promise<string | null> => {
  try {
    const key = await deriveKey(pin, salt);
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(iv) }, key, ub64(content));
    return new TextDecoder().decode(dec);
  } catch { return null; }
};

const hashPin = async (pin: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// ─── Password Strength ────────────────────────────────────────────────────────
const getStrength = (pw: string): { score: number; label: string; color: string } => {
  if (!pw) return { score: 0, label: '', color: '#333' };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak', color: '#e63950' };
  if (score <= 3) return { score, label: 'Medium', color: '#f59e0b' };
  return { score, label: 'Strong', color: '#4ade80' };
};

// ─── Password Generator ───────────────────────────────────────────────────────
const generatePassword = (len = 16, useSymbols = true, useNumbers = true, useUpper = true) => {
  const lower   = 'abcdefghijklmnopqrstuvwxyz';
  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nums    = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  let chars = lower;
  if (useUpper)   chars += upper;
  if (useNumbers) chars += nums;
  if (useSymbols) chars += symbols;
  const arr = rnd(len);
  return Array.from(arr).map(b => chars[b % chars.length]).join('');
};

// ─── Platform Icon Component ──────────────────────────────────────────────────
const PlatformIcon = ({ platform, size = 24 }: { platform: string; size?: number }) => {
  const p = PLATFORM_ICONS[platform] || PLATFORM_ICONS.custom;
  return (
    <span
      style={{ width: size, height: size, display: 'inline-flex', color: p.color, flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: p.svg }}
    />
  );
};

// ─── PinPad ───────────────────────────────────────────────────────────────────
const PinPad = ({
  title, subtitle, onComplete, error, loading, onOptionsClick, showOptions
}: {
  title: string; subtitle?: string; onComplete: (p: string) => void;
  error?: string; loading?: boolean; onOptionsClick?: () => void; showOptions?: boolean;
}) => {
  const [entered, setEntered] = useState('');
  const submittedRef = useRef(false);
  const MAX = 4;

  useEffect(() => { if (error) { setEntered(''); submittedRef.current = false; } }, [error]);

  const press = useCallback((k: string) => {
    if (loading || submittedRef.current) return;
    if (k === 'del') { setEntered(p => p.slice(0, -1)); return; }
    if (entered.length >= MAX) return;
    const next = entered + k;
    setEntered(next);
    if (next.length === MAX) {
      submittedRef.current = true;
      setTimeout(() => { onComplete(next); setEntered(''); submittedRef.current = false; }, 150);
    }
  }, [entered, loading, onComplete]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [press]);

  const rows = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','del']];

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#080c14', padding:'32px 16px', fontFamily:"'SF Pro Display',-apple-system,sans-serif" }}>
      <div style={{ textAlign:'center', marginBottom:32 }}>
        <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(6,182,212,0.12)', border:'1.5px solid rgba(6,182,212,0.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <Shield size={28} color="#06b6d4" />
        </div>
        <div style={{ fontSize:22, fontWeight:600, color:'#fff', marginBottom:6 }}>{title}</div>
        {subtitle && <div style={{ fontSize:13, color:'#555', marginTop:4 }}>{subtitle}</div>}
      </div>
      <div style={{ display:'flex', gap:18, marginBottom:24 }}>
        {Array.from({ length: MAX }).map((_, i) => (
          <div key={i} style={{ width:14, height:14, borderRadius:'50%', border:'2px solid #06b6d4', background: i < entered.length ? '#06b6d4' : 'transparent', transition:'background 0.15s' }} />
        ))}
      </div>
      {error && (
        <div style={{ display:'flex', alignItems:'center', gap:6, color:'#e63950', fontSize:12, marginBottom:16, background:'rgba(230,57,80,0.08)', padding:'6px 14px', borderRadius:8, border:'1px solid rgba(230,57,80,0.2)' }}>
          <AlertTriangle size={13} color="#e63950" /><span>{error}</span>
        </div>
      )}
      {loading && <div style={{ color:'#555', fontSize:12, marginBottom:12 }}>Please wait...</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:12, width:'100%', maxWidth:280 }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display:'flex', gap:12, justifyContent:'center' }}>
            {row.map((k, ki) => {
              if (!k) return <div key={ki} style={{ width:80, height:80 }} />;
              return (
                <button key={ki} onClick={() => press(k)} disabled={loading}
                  style={{ width:80, height:80, borderRadius:'50%', border: k === 'del' ? 'none' : '1.5px solid rgba(6,182,212,0.4)', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {k === 'del'
                    ? <span style={{ fontSize:20, color:'#06b6d4' }}>⌫</span>
                    : <span style={{ fontSize:26, fontWeight:300, color:'#67e8f9', lineHeight:1 }}>{k}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {showOptions && onOptionsClick && (
        <button onClick={onOptionsClick} style={{ marginTop:28, background:'transparent', border:'none', color:'#444', fontSize:14, cursor:'pointer', textDecoration:'underline' }}>Options</button>
      )}
    </div>
  );
};

// ─── Password Generator Modal ─────────────────────────────────────────────────
const GenModal = ({ onUse, onClose }: { onUse: (pw: string) => void; onClose: () => void }) => {
  const [len,     setLen]     = useState(16);
  const [symbols, setSymbols] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [upper,   setUpper]   = useState(true);
  const [pw,      setPw]      = useState(() => generatePassword(16, true, true, true));
  const [copied,  setCopied]  = useState(false);

  const regen = () => setPw(generatePassword(len, symbols, numbers, upper));
  useEffect(() => { regen(); }, [len, symbols, numbers, upper]);

  const copyPw = () => {
    navigator.clipboard.writeText(pw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const str = getStrength(pw);

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(8px)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'#0d1117', border:'1px solid #111827', borderRadius:'20px 20px 0 0', padding:'28px 20px 40px', width:'100%', maxWidth:480 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ color:'#fff', fontSize:18, fontWeight:600 }}>Password Generator</div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#555', cursor:'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ background:'#080c14', border:'1px solid #111827', borderRadius:12, padding:'14px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ flex:1, color:'#e2e8f0', fontSize:15, fontFamily:'monospace', wordBreak:'break-all' }}>{pw}</span>
          <button onClick={regen} style={{ background:'transparent', border:'none', color:'#06b6d4', cursor:'pointer' }}><RefreshCw size={16} /></button>
          <button onClick={copyPw} style={{ background:'transparent', border:'none', color: copied ? '#4ade80' : '#06b6d4', cursor:'pointer' }}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <div style={{ display:'flex', gap:6, marginBottom:16 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ flex:1, height:4, borderRadius:4, background: i <= str.score ? str.color : '#111827', transition:'background 0.3s' }} />
          ))}
          <span style={{ fontSize:12, color: str.color, minWidth:50, textAlign:'right' }}>{str.label}</span>
        </div>
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ color:'#888', fontSize:13 }}>Length: <strong style={{ color:'#fff' }}>{len}</strong></span>
            <input type="range" min={8} max={32} value={len} onChange={e => setLen(+e.target.value)}
              style={{ width:160, accentColor:'#06b6d4' }} />
          </div>
          {[
            { label:'Uppercase (A-Z)', val: upper,   set: setUpper },
            { label:'Numbers (0-9)',   val: numbers, set: setNumbers },
            { label:'Symbols (!@#)',   val: symbols, set: setSymbols },
          ].map(({ label, val, set }) => (
            <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #111827' }}>
              <span style={{ color:'#aaa', fontSize:13 }}>{label}</span>
              <div onClick={() => set(v => !v)} style={{ width:40, height:22, borderRadius:11, background: val ? '#06b6d4' : '#1e2d3d', cursor:'pointer', position:'relative', transition:'background 0.2s' }}>
                <div style={{ position:'absolute', top:3, left: val ? 19 : 3, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:12, background:'transparent', border:'1px solid #1e2d3d', color:'#888', cursor:'pointer', fontSize:14 }}>Cancel</button>
          <button onClick={() => { onUse(pw); onClose(); }} style={{ flex:2, padding:'12px', borderRadius:12, background:'linear-gradient(135deg,#06b6d4,#0891b2)', border:'none', color:'#fff', cursor:'pointer', fontWeight:600, fontSize:14 }}>Use this password</button>
        </div>
      </div>
    </div>
  );
};

// ─── Add / Edit Entry Modal ───────────────────────────────────────────────────
const EntryModal = ({
  initial, onSave, onClose, activePin
}: {
  initial?: VaultEntry | null;
  onSave: (e: Omit<VaultEntry, 'id' | 'createdAt' | 'updatedAt' | 'starred'>) => void;
  onClose: () => void;
  activePin: string;
}) => {
  const [platform,    setPlatform]    = useState(initial?.platform || 'instagram');
  const [customName,  setCustomName]  = useState(initial?.customName || '');
  const [username,    setUsername]    = useState(initial?.username || '');
  const [password,    setPassword]    = useState('');
  const [url,         setUrl]         = useState(initial?.url || '');
  const [notes,       setNotes]       = useState(initial?.notes || '');
  const [category,    setCategory]    = useState(initial?.category || 'Social Media');
  const [showPw,      setShowPw]      = useState(false);
  const [showGen,     setShowGen]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => {
    if (initial) {
      (async () => {
        const dec = await decrypt(initial.password, initial.iv, activePin, initial.salt);
        if (dec) setPassword(dec);
      })();
    }
  }, []);

  const str = getStrength(password);

  const handleSave = async () => {
    if (!username.trim()) { setError('Username / Email required'); return; }
    if (!password.trim()) { setError('Password required'); return; }
    setLoading(true);
    try {
      const salt = genSalt();
      const enc  = await encrypt(password, activePin, salt);
      onSave({ platform, customName, username: username.trim(), password: enc.content, iv: enc.iv, salt, category, notes, url });
    } catch (e) { setError('Encryption failed'); }
    finally { setLoading(false); }
  };

  const platformList = Object.entries(PLATFORM_ICONS);

  return (
    <>
      <div style={{ position:'fixed', inset:0, zIndex:999, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(8px)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
        <div style={{ background:'#0d1117', border:'1px solid #111827', borderRadius:'20px 20px 0 0', padding:'24px 20px 40px', width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div style={{ color:'#fff', fontSize:18, fontWeight:600 }}>{initial ? 'Edit Entry' : 'Add Password'}</div>
            <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#555', cursor:'pointer' }}><X size={20} /></button>
          </div>

          {/* Platform picker */}
          <div style={{ marginBottom:16 }}>
            <div style={{ color:'#888', fontSize:12, marginBottom:8 }}>Platform</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {platformList.map(([key, val]) => (
                <button key={key} onClick={() => { setPlatform(key); if (key !== 'custom') { const cats = SOCIAL_PLATFORMS.includes(key) ? 'Social Media' : EMAIL_PLATFORMS.includes(key) ? 'Email' : ENT_PLATFORMS.includes(key) ? 'Entertainment' : WORK_PLATFORMS.includes(key) ? 'Work' : 'Other'; setCategory(cats); } }}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:20, border: platform === key ? `1.5px solid ${val.color}` : '1px solid #1e2d3d', background: platform === key ? `${val.color}18` : 'transparent', cursor:'pointer' }}>
                  <span style={{ width:16, height:16, display:'inline-flex', color: val.color }} dangerouslySetInnerHTML={{ __html: val.svg }} />
                  <span style={{ fontSize:12, color: platform === key ? '#fff' : '#888' }}>{val.label}</span>
                </button>
              ))}
            </div>
          </div>

          {platform === 'custom' && (
            <div style={{ marginBottom:14 }}>
              <div style={{ color:'#888', fontSize:12, marginBottom:6 }}>Site / App Name</div>
              <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. My Bank"
                style={{ width:'100%', background:'#080c14', border:'1px solid #1e2d3d', borderRadius:10, padding:'11px 14px', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }} />
            </div>
          )}

          {/* Category */}
          <div style={{ marginBottom:14 }}>
            <div style={{ color:'#888', fontSize:12, marginBottom:6 }}>Category</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {CATEGORIES.filter(c => c !== 'All').map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  style={{ padding:'5px 12px', borderRadius:16, border: category === c ? '1px solid #06b6d4' : '1px solid #1e2d3d', background: category === c ? 'rgba(6,182,212,0.15)' : 'transparent', color: category === c ? '#67e8f9' : '#666', fontSize:12, cursor:'pointer' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Username */}
          <div style={{ marginBottom:14 }}>
            <div style={{ color:'#888', fontSize:12, marginBottom:6 }}>Username / Email</div>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="your@email.com"
              style={{ width:'100%', background:'#080c14', border:'1px solid #1e2d3d', borderRadius:10, padding:'11px 14px', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }} />
          </div>

          {/* Password */}
          <div style={{ marginBottom:6 }}>
            <div style={{ color:'#888', fontSize:12, marginBottom:6 }}>Password</div>
            <div style={{ position:'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password"
                style={{ width:'100%', background:'#080c14', border:'1px solid #1e2d3d', borderRadius:10, padding:'11px 44px 11px 14px', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }} />
              <div style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', display:'flex', gap:6 }}>
                <button onClick={() => setShowPw(v => !v)} style={{ background:'none', border:'none', color:'#555', cursor:'pointer' }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* Strength */}
          {password && (
            <div style={{ display:'flex', gap:4, alignItems:'center', marginBottom:14 }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ flex:1, height:3, borderRadius:3, background: i <= str.score ? str.color : '#111827' }} />
              ))}
              <span style={{ fontSize:11, color:str.color, minWidth:48, textAlign:'right' }}>{str.label}</span>
            </div>
          )}

          {/* Generator button */}
          <button onClick={() => setShowGen(true)} style={{ display:'flex', alignItems:'center', gap:6, color:'#06b6d4', background:'transparent', border:'none', cursor:'pointer', fontSize:13, marginBottom:14 }}>
            <Zap size={14} /> Generate strong password
          </button>

          {/* URL */}
          <div style={{ marginBottom:14 }}>
            <div style={{ color:'#888', fontSize:12, marginBottom:6 }}>Website URL (optional)</div>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."
              style={{ width:'100%', background:'#080c14', border:'1px solid #1e2d3d', borderRadius:10, padding:'11px 14px', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }} />
          </div>

          {/* Notes */}
          <div style={{ marginBottom:20 }}>
            <div style={{ color:'#888', fontSize:12, marginBottom:6 }}>Notes (optional)</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Recovery email, backup codes..."
              style={{ width:'100%', height:72, background:'#080c14', border:'1px solid #1e2d3d', borderRadius:10, padding:'10px 14px', color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box', resize:'none', fontFamily:'inherit' }} />
          </div>

          {error && <div style={{ color:'#e63950', fontSize:12, marginBottom:12 }}>{error}</div>}

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:'13px', borderRadius:12, background:'transparent', border:'1px solid #1e2d3d', color:'#888', cursor:'pointer', fontSize:14 }}>Cancel</button>
            <button onClick={handleSave} disabled={loading}
              style={{ flex:2, padding:'13px', borderRadius:12, background:'linear-gradient(135deg,#06b6d4,#0891b2)', border:'none', color:'#fff', cursor:'pointer', fontWeight:600, fontSize:14 }}>
              {loading ? 'Saving...' : initial ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
      {showGen && <GenModal onUse={pw => setPassword(pw)} onClose={() => setShowGen(false)} />}
    </>
  );
};

// ─── Entry Card ───────────────────────────────────────────────────────────────
const EntryCard = ({
  entry, activePin, onEdit, onDelete, onToggleStar
}: {
  entry: VaultEntry; activePin: string;
  onEdit: () => void; onDelete: () => void; onToggleStar: () => void;
}) => {
  const [decPw,   setDecPw]   = useState<string | null>(null);
  const [copied,  setCopied]  = useState<'user' | 'pass' | null>(null);
  const [loading, setLoading] = useState(false);

  const p = PLATFORM_ICONS[entry.platform] || PLATFORM_ICONS.custom;
  const label = entry.platform === 'custom' ? (entry.customName || 'Custom') : p.label;

  const revealPw = async () => {
    if (decPw !== null) { setDecPw(null); return; }
    setLoading(true);
    const d = await decrypt(entry.password, entry.iv, activePin, entry.salt);
    setDecPw(d);
    setLoading(false);
  };

  const copyField = async (field: 'user' | 'pass') => {
    let text = '';
    if (field === 'user') text = entry.username;
    else {
      text = decPw ?? await decrypt(entry.password, entry.iv, activePin, entry.salt) ?? '';
    }
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
    // auto-clear clipboard after 30s
    setTimeout(async () => {
      try { const c = await navigator.clipboard.readText(); if (c === text) await navigator.clipboard.writeText(''); } catch {}
    }, 30_000);
  };

  const str = decPw ? getStrength(decPw) : null;

  return (
    <div style={{ background:'#0d1117', border:'1px solid #111827', borderRadius:16, padding:'14px 16px', marginBottom:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
        <div style={{ width:40, height:40, borderRadius:10, background:`${p.color}18`, border:`1px solid ${p.color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <PlatformIcon platform={entry.platform} size={22} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:'#fff', fontSize:15, fontWeight:600 }}>{label}</div>
          <div style={{ color:'#555', fontSize:11 }}>{entry.category}</div>
        </div>
        <button onClick={onToggleStar} style={{ background:'transparent', border:'none', cursor:'pointer', color: entry.starred ? '#f59e0b' : '#333', padding:4 }}>
          {entry.starred ? <Star size={16} fill="#f59e0b" /> : <Star size={16} />}
        </button>
      </div>

      {/* Username row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', background:'#080c14', borderRadius:8, marginBottom:6 }}>
        <div>
          <div style={{ color:'#555', fontSize:10, marginBottom:2 }}>USERNAME / EMAIL</div>
          <div style={{ color:'#e2e8f0', fontSize:13, fontFamily:'monospace' }}>{entry.username}</div>
        </div>
        <button onClick={() => copyField('user')} style={{ background:'transparent', border:'none', color: copied === 'user' ? '#4ade80' : '#06b6d4', cursor:'pointer' }}>
          {copied === 'user' ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>

      {/* Password row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', background:'#080c14', borderRadius:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:'#555', fontSize:10, marginBottom:2 }}>PASSWORD {str && <span style={{ color:str.color }}>• {str.label}</span>}</div>
          <div style={{ color:'#e2e8f0', fontSize:13, fontFamily:'monospace', wordBreak:'break-all' }}>
            {loading ? '...' : decPw !== null ? decPw : '••••••••••••'}
          </div>
        </div>
        <div style={{ display:'flex', gap:4, flexShrink:0 }}>
          <button onClick={revealPw} style={{ background:'transparent', border:'none', color:'#06b6d4', cursor:'pointer', padding:4 }}>
            {decPw !== null ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button onClick={() => copyField('pass')} style={{ background:'transparent', border:'none', color: copied === 'pass' ? '#4ade80' : '#06b6d4', cursor:'pointer', padding:4 }}>
            {copied === 'pass' ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {entry.notes && (
        <div style={{ marginTop:8, padding:'8px 10px', background:'rgba(6,182,212,0.05)', border:'1px solid rgba(6,182,212,0.1)', borderRadius:8, color:'#666', fontSize:12 }}>
          {entry.notes}
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button onClick={onEdit} style={{ flex:1, padding:'8px', borderRadius:8, background:'transparent', border:'1px solid #1e2d3d', color:'#888', fontSize:12, cursor:'pointer' }}>Edit</button>
        <button onClick={onDelete} style={{ flex:1, padding:'8px', borderRadius:8, background:'rgba(230,57,80,0.06)', border:'1px solid rgba(230,57,80,0.2)', color:'#e63950', fontSize:12, cursor:'pointer' }}>Delete</button>
      </div>
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
type Screen = 'loading' | 'create-pin' | 'confirm-pin' | 'unlock' | 'vault';
type Tab    = 'passwords' | 'notes';
type Modal  = null | 'add-entry' | 'edit-entry' | 'options' | 'change-current' | 'change-new' | 'change-confirm' | 'forgot' | 'export' | 'import' | 'gen' | 'add-note' | 'confirm-delete';

export const SecureVault = () => {
  const [screen,        setScreen]        = useState<Screen>('loading');
  const [tab,           setTab]           = useState<Tab>('passwords');
  const [modal,         setModal]         = useState<Modal>(null);
  const [pinError,      setPinError]      = useState('');
  const [fails,         setFails]         = useState(0);
  const [locked,        setLocked]        = useState(false);
  const [unlockTime,    setUnlockTime]    = useState<Date | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [flash,         setFlash]         = useState('');
  const [flashOk,       setFlashOk]       = useState(true);
  const [entries,       setEntries]       = useState<VaultEntry[]>([]);
  const [secNotes,      setSecNotes]      = useState<SecureNote[]>([]);
  const [search,        setSearch]        = useState('');
  const [catFilter,     setCatFilter]     = useState('All');
  const [editTarget,    setEditTarget]    = useState<VaultEntry | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<{ type: 'entry' | 'note'; id: string } | null>(null);
  const [changePinErr,  setChangePinErr]  = useState('');
  const [newPinTemp,    setNewPinTemp]    = useState('');
  const [firstPin,      setFirstPin]      = useState('');
  const [pinKey,        setPinKey]        = useState(0);
  const [forgotText,    setForgotText]    = useState('');
  const [forgotErr,     setForgotErr]     = useState('');
  // Note form
  const [noteTitle,     setNoteTitle]     = useState('');
  const [noteContent,   setNoteContent]   = useState('');

  const activePinRef  = useRef('');
  const processingRef = useRef(false);
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const INACTIVITY    = 5 * 60 * 1000;

  const showFlash = (msg: string, ok = true) => {
    setFlash(msg); setFlashOk(ok);
    setTimeout(() => setFlash(''), 2500);
  };

  const getPin = () => activePinRef.current || sessionStorage.getItem(SS_PIN) || '';

  // ─── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const pinHash = getVault().pinHash;
    const ssPin   = sessionStorage.getItem(SS_PIN);
    if (pinHash && ssPin) {
      activePinRef.current = ssPin;
      setUnlockTime(new Date());
      setScreen('vault');
      return;
    }
    setScreen(pinHash ? 'unlock' : 'create-pin');
  }, []);

  // ─── Load data ───────────────────────────────────────────────────────────
  const reload = useCallback(() => {
    const v = getVault();
    setEntries(v.entries || []);
    setSecNotes(v.notes  || []);
  }, []);

  useEffect(() => { if (screen === 'vault') { setSearch(''); setCatFilter('All'); reload(); } }, [screen]);

  // ─── Inactivity lock ─────────────────────────────────────────────────────
  const lockVault = useCallback((reason?: string) => {
    setScreen('unlock');
    activePinRef.current = '';
    setPinError(reason ?? '');
    setFails(0);
    sessionStorage.removeItem(SS_PIN);
    setModal(null);
    setPinKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (screen !== 'vault') return;
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => lockVault('Locked due to inactivity.'), INACTIVITY);
    };
    window.addEventListener('click', reset);
    window.addEventListener('keypress', reset);
    reset();
    return () => { window.removeEventListener('click', reset); window.removeEventListener('keypress', reset); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [screen, lockVault]);

  const savePin = (p: string) => { activePinRef.current = p; sessionStorage.setItem(SS_PIN, p); };

  // ─── PIN Create ──────────────────────────────────────────────────────────
  const handleCreatePin = (pin: string) => {
    if (processingRef.current) return;
    setPinError(''); setFirstPin(pin); setPinKey(k => k + 1); setScreen('confirm-pin');
  };

  const handleConfirmPin = useCallback(async (pin: string) => {
    if (processingRef.current) return;
    if (pin !== firstPin) {
      setPinError("PINs don't match. Try again.");
      setFirstPin(''); setPinKey(k => k + 1); setScreen('create-pin'); return;
    }
    processingRef.current = true; setLoading(true);
    try {
      const vault = getVault();
      vault.pinHash = await hashPin(pin);
      saveVault(vault);
      savePin(pin);
      setFirstPin(''); setUnlockTime(new Date()); setPinKey(k => k + 1); setScreen('vault');
    } catch { setPinError('Error. Try again.'); setFirstPin(''); setPinKey(k => k + 1); setScreen('create-pin'); }
    finally { setLoading(false); processingRef.current = false; }
  }, [firstPin]);

  // ─── Unlock ──────────────────────────────────────────────────────────────
  const handleUnlock = useCallback(async (pin: string) => {
    if (processingRef.current || locked) return;
    processingRef.current = true; setLoading(true); setPinError('');
    try {
      const vault = getVault();
      if (!vault.pinHash) { setScreen('create-pin'); return; }
      if (await hashPin(pin) !== vault.pinHash) {
        const att = fails + 1; setFails(att); setPinKey(k => k + 1);
        if (att >= 5) {
          setLocked(true);
          setTimeout(() => { setLocked(false); setFails(0); }, 5 * 60 * 1000);
          setPinError('Locked 5 min — too many failed attempts.');
        } else { setPinError(`Wrong PIN. ${5 - att} attempt${5 - att !== 1 ? 's' : ''} left.`); }
        return;
      }
      savePin(pin); setFails(0); setUnlockTime(new Date()); setScreen('vault');
    } catch { setPinError('Error. Try again.'); setPinKey(k => k + 1); }
    finally { setLoading(false); processingRef.current = false; }
  }, [locked, fails]);

  // ─── Change PIN ──────────────────────────────────────────────────────────
  const handleChangeCurrent = async (pin: string) => {
    setChangePinErr(''); setLoading(true);
    try {
      const v = getVault();
      if (await hashPin(pin) !== v.pinHash) { setChangePinErr('Wrong PIN.'); setPinKey(k => k + 1); return; }
      setModal('change-new');
    } catch { setChangePinErr('Error.'); }
    finally { setLoading(false); }
  };

  const handleChangeNew    = (pin: string) => { setNewPinTemp(pin); setModal('change-confirm'); };

  const handleChangeConfirm = async (pin: string) => {
    if (pin !== newPinTemp) { setChangePinErr("PINs don't match."); setModal('change-new'); setNewPinTemp(''); return; }
    setLoading(true); setChangePinErr('');
    try {
      const oldPin = getPin();
      const vault  = getVault();
      // Re-encrypt all entries
      const newEntries: VaultEntry[] = [];
      for (const e of vault.entries) {
        const dec = await decrypt(e.password, e.iv, oldPin, e.salt);
        if (!dec) { newEntries.push(e); continue; }
        const ns = genSalt(); const enc = await encrypt(dec, pin, ns);
        newEntries.push({ ...e, password: enc.content, iv: enc.iv, salt: ns });
      }
      // Re-encrypt all notes
      const newNotes: SecureNote[] = [];
      for (const n of vault.notes) {
        const dec = await decrypt(n.content, n.iv, oldPin, n.salt);
        if (!dec) { newNotes.push(n); continue; }
        const ns = genSalt(); const enc = await encrypt(dec, pin, ns);
        newNotes.push({ ...n, content: enc.content, iv: enc.iv, salt: ns });
      }
      vault.entries  = newEntries;
      vault.notes    = newNotes;
      vault.pinHash  = await hashPin(pin);
      saveVault(vault);
      savePin(pin);
      setNewPinTemp(''); setModal(null); reload();
      showFlash('PIN changed!');
    } catch { setChangePinErr('Error.'); }
    finally { setLoading(false); }
  };

  // ─── Reset vault ─────────────────────────────────────────────────────────
  const handleReset = () => {
    if (forgotText.trim().toUpperCase() !== 'RESET') { setForgotErr('Type RESET to confirm.'); return; }
    localStorage.removeItem(LS_KEY);
    sessionStorage.removeItem(SS_PIN);
    activePinRef.current = '';
    setEntries([]); setSecNotes([]); setForgotText(''); setModal(null);
    setPinError('Vault reset. Create a new PIN.'); setFirstPin(''); setPinKey(k => k + 1);
    setScreen('create-pin');
  };

  // ─── Password entries ─────────────────────────────────────────────────────
  const handleSaveEntry = (data: Omit<VaultEntry, 'id' | 'createdAt' | 'updatedAt' | 'starred'>) => {
    const vault = getVault();
    if (editTarget) {
      vault.entries = vault.entries.map(e =>
        e.id === editTarget.id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e
      );
      showFlash('Entry updated!');
    } else {
      vault.entries.unshift({ ...data, id: genId(), starred: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      showFlash('Password saved!');
    }
    saveVault(vault); setModal(null); setEditTarget(null); reload();
  };

  const handleDeleteEntry = (id: string) => {
    const vault = getVault();
    vault.entries = vault.entries.filter(e => e.id !== id);
    saveVault(vault); reload(); showFlash('Deleted.');
  };

  const handleToggleStar = (id: string) => {
    const vault = getVault();
    vault.entries = vault.entries.map(e => e.id === id ? { ...e, starred: !e.starred } : e);
    saveVault(vault); reload();
  };

  // ─── Secure Notes ────────────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) { showFlash('Title and content required', false); return; }
    const pin = getPin();
    const salt = genSalt();
    const enc  = await encrypt(noteContent.trim(), pin, salt);
    const vault = getVault();
    vault.notes.unshift({ id: genId(), title: noteTitle.trim(), content: enc.content, iv: enc.iv, salt, starred: false, createdAt: new Date().toISOString() });
    saveVault(vault); setNoteTitle(''); setNoteContent(''); setModal(null); reload();
    showFlash('Note saved!');
  };

  // ─── Export / Import ─────────────────────────────────────────────────────
  const handleExport = () => {
    const data = localStorage.getItem(LS_KEY) || '{}';
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `vault-backup-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
    showFlash('Vault exported!');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.pinHash) { showFlash('Invalid backup file', false); return; }
        localStorage.setItem(LS_KEY, JSON.stringify(data));
        sessionStorage.removeItem(SS_PIN);
        activePinRef.current = '';
        setModal(null);
        setPinError('Backup loaded. Enter your PIN.');
        setPinKey(k => k + 1);
        setScreen('unlock');
      } catch { showFlash('Import failed', false); }
    };
    reader.readAsText(file);
  };

  // ─── Filtered entries ─────────────────────────────────────────────────────
  const filteredEntries = entries
    .filter(e => catFilter === 'All' || e.category === catFilter)
    .filter(e => {
      const q = search.toLowerCase();
      if (!q) return true;
      const label = (PLATFORM_ICONS[e.platform]?.label || e.customName || '').toLowerCase();
      return label.includes(q) || e.username.toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q);
    })
    .sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0));

  // ─── Screens ──────────────────────────────────────────────────────────────
  if (screen === 'loading') return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#080c14', gap:12, flexDirection:'column' }}>
      <Shield size={32} color="#06b6d4" />
      <div style={{ color:'#555', fontSize:14 }}>Loading vault...</div>
    </div>
  );

  if (screen === 'create-pin') return (
    <PinPad key={`c-${pinKey}`} title="Create Your PIN" subtitle="Choose a 4-digit PIN to protect your vault"
      onComplete={handleCreatePin} error={pinError} loading={loading} />
  );

  if (screen === 'confirm-pin') return (
    <PinPad key={`cf-${pinKey}`} title="Confirm PIN" subtitle="Enter the same PIN again"
      onComplete={handleConfirmPin} error={pinError} loading={loading} />
  );

  if (screen === 'unlock') return (
    <>
      <PinPad key={`u-${pinKey}`} title="Enter PIN" subtitle="Vault is locked"
        onComplete={handleUnlock} error={pinError} loading={loading || locked}
        showOptions onOptionsClick={() => setModal('options')} />
      {modal === 'options' && (
        <div style={MS.backdrop}>
          <div style={MS.sheet}>
            <div style={MS.sheetTitle}>Options</div>
            <button style={MS.btn} onClick={() => { setModal('change-current'); setChangePinErr(''); }}>Change PIN</button>
            <button style={{ ...MS.btn, color:'#e63950', borderColor:'rgba(230,57,80,0.3)' }} onClick={() => { setModal('forgot'); setForgotErr(''); setForgotText(''); }}>Forgot PIN / Reset</button>
            <button style={{ ...MS.btn, borderColor:'transparent' }} onClick={() => setModal('import')}>
              Import Backup
              <input type="file" accept=".json" onChange={handleImport} style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer' }} />
            </button>
            <button style={MS.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
          </div>
        </div>
      )}
      {modal === 'forgot' && <ResetModal forgotText={forgotText} setForgotText={setForgotText} forgotErr={forgotErr} onReset={handleReset} onClose={() => setModal(null)} />}
      {modal === 'change-current' && <div style={MS.backdrop}><div style={MS.pinWrap}><PinPad key={`cc-${pinKey}`} title="Current PIN" onComplete={handleChangeCurrent} error={changePinErr} loading={loading} /><button style={MS.cancelLink} onClick={() => setModal(null)}>Cancel</button></div></div>}
      {modal === 'change-new'     && <div style={MS.backdrop}><div style={MS.pinWrap}><PinPad key={`cn-${pinKey}`} title="New PIN" onComplete={handleChangeNew} error={changePinErr} loading={loading} /><button style={MS.cancelLink} onClick={() => setModal(null)}>Cancel</button></div></div>}
      {modal === 'change-confirm' && <div style={MS.backdrop}><div style={MS.pinWrap}><PinPad key={`cof-${pinKey}`} title="Confirm New PIN" onComplete={handleChangeConfirm} error={changePinErr} loading={loading} /><button style={MS.cancelLink} onClick={() => setModal(null)}>Cancel</button></div></div>}
    </>
  );

  // ─── Vault ────────────────────────────────────────────────────────────────
  return (
    <div style={{ background:'#080c14', minHeight:'100vh', fontFamily:"'SF Pro Display',-apple-system,sans-serif", color:'#fff' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid #111827', position:'sticky', top:0, zIndex:10, background:'#080c14' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:'rgba(6,182,212,0.12)', border:'1px solid rgba(6,182,212,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Shield size={17} color="#06b6d4" />
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:700 }}>SecureVault</div>
            <div style={{ fontSize:10, color:'#4ade80' }}>🔓 {unlockTime?.toLocaleTimeString()}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setModal('options')} style={{ width:34, height:34, borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid #111827', color:'#666', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Settings size={15} />
          </button>
          <button onClick={() => lockVault()} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:10, background:'rgba(234,179,8,0.08)', border:'1px solid rgba(234,179,8,0.2)', color:'#facc15', fontSize:12, cursor:'pointer', fontWeight:600 }}>
            <Lock size={13} /> Lock
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', padding:'12px 16px 0', gap:8 }}>
        {(['passwords', 'notes'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:'8px 18px', borderRadius:20, border: tab === t ? '1px solid rgba(6,182,212,0.5)' : '1px solid #111827', background: tab === t ? 'rgba(6,182,212,0.12)' : 'transparent', color: tab === t ? '#67e8f9' : '#555', fontSize:13, fontWeight: tab === t ? 600 : 400, cursor:'pointer' }}>
            {t === 'passwords' ? `🔑 Passwords (${entries.length})` : `📝 Notes (${secNotes.length})`}
          </button>
        ))}
      </div>

      {flash && (
        <div style={{ margin:'12px 16px 0', padding:'10px 14px', borderRadius:10, background: flashOk ? 'rgba(74,222,128,0.08)' : 'rgba(230,57,80,0.08)', border:`1px solid ${flashOk ? 'rgba(74,222,128,0.25)' : 'rgba(230,57,80,0.25)'}`, color: flashOk ? '#4ade80' : '#f87171', fontSize:13 }}>
          {flash}
        </div>
      )}

      {/* ── Passwords Tab ── */}
      {tab === 'passwords' && (
        <div style={{ padding:'12px 16px' }}>
          {/* Search + Add */}
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <div style={{ flex:1, position:'relative' }}>
              <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#444' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search passwords..."
                style={{ width:'100%', background:'#0d1117', border:'1px solid #111827', borderRadius:10, padding:'10px 12px 10px 34px', color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box' }} />
            </div>
            <button onClick={() => { setEditTarget(null); setModal('add-entry'); }}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 14px', borderRadius:10, background:'linear-gradient(135deg,#06b6d4,#0891b2)', border:'none', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
              <Plus size={15} /> Add
            </button>
          </div>

          {/* Category filter */}
          <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:8, marginBottom:12, scrollbarWidth:'none' }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCatFilter(c)}
                style={{ padding:'5px 12px', borderRadius:16, border: catFilter === c ? '1px solid #06b6d4' : '1px solid #111827', background: catFilter === c ? 'rgba(6,182,212,0.15)' : 'transparent', color: catFilter === c ? '#67e8f9' : '#555', fontSize:12, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                {c}
              </button>
            ))}
          </div>

          {filteredEntries.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:'#333' }}>
              <Key size={32} style={{ marginBottom:12, opacity:0.3 }} />
              <div style={{ fontSize:14 }}>{search ? 'No results' : 'No passwords saved yet'}</div>
              <div style={{ fontSize:12, marginTop:6, color:'#1e2d3d' }}>Tap Add to save your first password</div>
            </div>
          ) : filteredEntries.map(e => (
            <EntryCard key={e.id} entry={e} activePin={getPin()}
              onEdit={() => { setEditTarget(e); setModal('edit-entry'); }}
              onDelete={() => setDeleteTarget({ type: 'entry', id: e.id })}
              onToggleStar={() => handleToggleStar(e.id)} />
          ))}
        </div>
      )}

      {/* ── Notes Tab ── */}
      {tab === 'notes' && (
        <div style={{ padding:'12px 16px' }}>
          <button onClick={() => setModal('add-note')}
            style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'14px', borderRadius:12, background:'rgba(6,182,212,0.06)', border:'1px dashed rgba(6,182,212,0.3)', color:'#06b6d4', fontSize:14, cursor:'pointer', justifyContent:'center', marginBottom:14 }}>
            <Plus size={16} /> Add Encrypted Note
          </button>
          {secNotes.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:'#333' }}>
              <FileText size={32} style={{ marginBottom:12, opacity:0.3 }} />
              <div style={{ fontSize:14 }}>No secure notes yet</div>
            </div>
          ) : (
            <NotesList notes={secNotes} activePin={getPin()} onDelete={id => setDeleteTarget({ type: 'note', id })} onToggleStar={id => {
              const v = getVault(); v.notes = v.notes.map(n => n.id === id ? { ...n, starred: !n.starred } : n); saveVault(v); reload();
            }} />
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {(modal === 'add-entry' || modal === 'edit-entry') && (
        <EntryModal initial={editTarget} activePin={getPin()} onSave={handleSaveEntry} onClose={() => { setModal(null); setEditTarget(null); }} />
      )}

      {modal === 'add-note' && (
        <div style={MS.backdrop}>
          <div style={MS.sheet}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={MS.sheetTitle}>New Secure Note</div>
              <button onClick={() => setModal(null)} style={{ background:'none', border:'none', color:'#555', cursor:'pointer' }}><X size={20} /></button>
            </div>
            <input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Note title..."
              style={{ width:'100%', background:'#080c14', border:'1px solid #111827', borderRadius:10, padding:'11px 14px', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box', marginBottom:10 }} />
            <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Type your secret note..."
              style={{ width:'100%', height:120, background:'#080c14', border:'1px solid #111827', borderRadius:10, padding:'11px 14px', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box', resize:'none', fontFamily:'inherit', marginBottom:16 }} />
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setModal(null)} style={{ flex:1, padding:'12px', borderRadius:10, background:'transparent', border:'1px solid #111827', color:'#888', cursor:'pointer' }}>Cancel</button>
              <button onClick={handleSaveNote} style={{ flex:2, padding:'12px', borderRadius:10, background:'linear-gradient(135deg,#06b6d4,#0891b2)', border:'none', color:'#fff', fontWeight:600, cursor:'pointer' }}>Save Note</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'options' && (
        <div style={MS.backdrop}>
          <div style={MS.sheet}>
            <div style={MS.sheetTitle}>Vault Options</div>
            <button style={MS.btn} onClick={() => { setModal('change-current'); setChangePinErr(''); }}>Change PIN</button>
            <button style={MS.btn} onClick={handleExport}><Download size={15} style={{ marginRight:8 }} />Export Backup</button>
            <button style={{ ...MS.btn, position:'relative', overflow:'hidden' }}>
              <Upload size={15} style={{ marginRight:8 }} />Import Backup
              <input type="file" accept=".json" onChange={handleImport} style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer' }} />
            </button>
            <button style={{ ...MS.btn, color:'#e63950', borderColor:'rgba(230,57,80,0.3)' }} onClick={() => { setModal('forgot'); setForgotErr(''); setForgotText(''); }}>Reset Vault</button>
            <button style={MS.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
          </div>
        </div>
      )}

      {modal === 'change-current' && <div style={MS.backdrop}><div style={MS.pinWrap}><PinPad key={`cc2-${pinKey}`} title="Current PIN" onComplete={handleChangeCurrent} error={changePinErr} loading={loading} /><button style={MS.cancelLink} onClick={() => setModal(null)}>Cancel</button></div></div>}
      {modal === 'change-new'     && <div style={MS.backdrop}><div style={MS.pinWrap}><PinPad key={`cn2-${pinKey}`} title="New PIN" onComplete={handleChangeNew} error={changePinErr} loading={loading} /><button style={MS.cancelLink} onClick={() => setModal(null)}>Cancel</button></div></div>}
      {modal === 'change-confirm' && <div style={MS.backdrop}><div style={MS.pinWrap}><PinPad key={`cof2-${pinKey}`} title="Confirm New PIN" onComplete={handleChangeConfirm} error={changePinErr} loading={loading} /><button style={MS.cancelLink} onClick={() => setModal(null)}>Cancel</button></div></div>}

      {modal === 'forgot' && <ResetModal forgotText={forgotText} setForgotText={setForgotText} forgotErr={forgotErr} onReset={handleReset} onClose={() => setModal(null)} />}

      {deleteTarget && (
        <div style={MS.backdrop}>
          <div style={MS.sheet}>
            <div style={MS.sheetTitle}>Delete?</div>
            <div style={{ color:'#888', fontSize:14, marginBottom:20 }}>This will be permanently deleted.</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex:1, padding:'12px', borderRadius:10, background:'transparent', border:'1px solid #111827', color:'#888', cursor:'pointer' }}>Cancel</button>
              <button onClick={() => {
                if (deleteTarget.type === 'entry') handleDeleteEntry(deleteTarget.id);
                else {
                  const v = getVault(); v.notes = v.notes.filter(n => n.id !== deleteTarget.id);
                  saveVault(v); reload(); showFlash('Note deleted.');
                }
                setDeleteTarget(null);
              }} style={{ flex:2, padding:'12px', borderRadius:10, background:'#e63950', border:'none', color:'#fff', fontWeight:600, cursor:'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Notes List ───────────────────────────────────────────────────────────────
const NotesList = ({ notes, activePin, onDelete, onToggleStar }: {
  notes: SecureNote[]; activePin: string;
  onDelete: (id: string) => void; onToggleStar: (id: string) => void;
}) => {
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const toggle = async (n: SecureNote) => {
    if (revealed[n.id]) { setRevealed(p => { const u = { ...p }; delete u[n.id]; return u; }); return; }
    const dec = await decrypt(n.content, n.iv, activePin, n.salt);
    if (dec) setRevealed(p => ({ ...p, [n.id]: dec }));
  };

  return (
    <div>
      {[...notes].sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0)).map(n => (
        <div key={n.id} style={{ background:'#0d1117', border:'1px solid #111827', borderRadius:14, padding:'14px 16px', marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <FileText size={15} color="#06b6d4" />
              <span style={{ color:'#fff', fontSize:14, fontWeight:600 }}>{n.title}</span>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => onToggleStar(n.id)} style={{ background:'transparent', border:'none', cursor:'pointer', color: n.starred ? '#f59e0b' : '#333', padding:2 }}>
                {n.starred ? <Star size={14} fill="#f59e0b" /> : <Star size={14} />}
              </button>
              <button onClick={() => toggle(n)} style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:8, background:'rgba(6,182,212,0.08)', border:'1px solid rgba(6,182,212,0.2)', color:'#67e8f9', fontSize:11, cursor:'pointer' }}>
                {revealed[n.id] ? <><EyeOff size={11} /> Hide</> : <><Eye size={11} /> View</>}
              </button>
              <button onClick={() => onDelete(n.id)} style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:8, background:'rgba(230,57,80,0.06)', border:'1px solid rgba(230,57,80,0.2)', color:'#e63950', fontSize:11, cursor:'pointer' }}>
                <Trash2 size={11} /> Del
              </button>
            </div>
          </div>
          {revealed[n.id] && (
            <div style={{ background:'#080c14', border:'1px solid #111827', borderRadius:8, padding:'10px 12px', color:'#e2e8f0', fontSize:13, lineHeight:1.6 }}>
              {revealed[n.id]}
            </div>
          )}
          <div style={{ color:'#333', fontSize:10, marginTop:6 }}>{new Date(n.createdAt).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
};

// ─── Reset Modal ──────────────────────────────────────────────────────────────
const ResetModal = ({ forgotText, setForgotText, forgotErr, onReset, onClose }: {
  forgotText: string; setForgotText: (v: string) => void;
  forgotErr: string; onReset: () => void; onClose: () => void;
}) => (
  <div style={MS.backdrop}>
    <div style={MS.sheet}>
      <div style={{ fontSize:32, marginBottom:10, textAlign:'center' }}>⚠️</div>
      <div style={MS.sheetTitle}>Reset Vault</div>
      <div style={{ color:'#888', fontSize:13, lineHeight:1.6, textAlign:'center', marginBottom:16 }}>
        Sab passwords aur notes <span style={{ color:'#e63950' }}>permanently delete</span> ho jayenge.<br />Confirm ke liye <strong style={{ color:'#fff' }}>RESET</strong> type karo.
      </div>
      <input value={forgotText} onChange={e => setForgotText(e.target.value)} placeholder='Type "RESET"'
        onKeyDown={e => e.key === 'Enter' && onReset()}
        style={{ width:'100%', background:'#080c14', border:'1px solid #1e2d3d', borderRadius:10, padding:'12px 14px', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box', marginBottom:8 }} />
      {forgotErr && <div style={{ color:'#e63950', fontSize:12, marginBottom:8 }}>{forgotErr}</div>}
      <button onClick={onReset} style={{ width:'100%', padding:'13px', borderRadius:10, background:'#e63950', border:'none', color:'#fff', fontWeight:600, fontSize:14, cursor:'pointer', marginBottom:8 }}>🗑 Reset Vault</button>
      <button onClick={onClose} style={MS.cancelBtn}>Cancel</button>
    </div>
  </div>
);

// ─── Alias — purane naam se import bhi kaam kare ─────────────────────────────
export { SecureVault as SecureNotesVault };
export default SecureVault;

// ─── Modal Styles ─────────────────────────────────────────────────────────────
const MS: Record<string, React.CSSProperties> = {
  backdrop: { position:'fixed', inset:0, zIndex:999, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(10px)', display:'flex', alignItems:'flex-end', justifyContent:'center' },
  sheet:    { background:'#0d1117', border:'1px solid #111827', borderRadius:'20px 20px 0 0', padding:'28px 20px 44px', width:'100%', maxWidth:480 },
  sheetTitle: { color:'#fff', fontSize:18, fontWeight:600, marginBottom:16, textAlign:'center' },
  btn:      { width:'100%', padding:'15px', borderRadius:12, background:'#0d1520', border:'1px solid #1e2d3d', color:'#fff', fontSize:15, fontWeight:500, cursor:'pointer', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'center' },
  cancelBtn:{ width:'100%', padding:'13px', borderRadius:12, background:'transparent', border:'none', color:'#555', fontSize:14, cursor:'pointer', marginTop:4 },
  pinWrap:  { background:'#080c14', borderRadius:'20px 20px 0 0', padding:'0 0 20px', width:'100%', maxWidth:480, display:'flex', flexDirection:'column', alignItems:'center' },
  cancelLink:{ background:'transparent', border:'none', color:'#555', fontSize:13, cursor:'pointer', textDecoration:'underline', marginTop:8 },
};