import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Shield, Lock, Unlock, Trash2, Plus, AlertTriangle, Eye, EyeOff,
} from 'lucide-react';
import {
  fetchEncryptedNotes, saveEncryptedNote, deleteEncryptedNote,
  fetchPinHash, savePinHash, deletePinHash, deleteAllUserNotes,
  supabase, EncryptedNote,
} from '../../lib/supabase';

// ─── Session keys (cleared when tab closes) ───────────────────────────────────
const SS_UNLOCKED = 'vnote_unlocked'; // value = user_id
const SS_PIN      = 'vnote_pin';      // value = raw pin

// ─── Crypto ───────────────────────────────────────────────────────────────────

const generateSalt = (): string =>
  btoa(String.fromCharCode(...window.crypto.getRandomValues(new Uint8Array(16))));

const deriveKey = async (pin: string, salt: string): Promise<CryptoKey> => {
  const base = await window.crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await window.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: Uint8Array.from(atob(salt), c => c.charCodeAt(0)), iterations: 100000, hash: 'SHA-256' },
    base, 256
  );
  return window.crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
};

const hashPin = async (pin: string): Promise<string> => {
  const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const b64  = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const ub64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

const doEncrypt = async (text: string, pin: string, salt: string) => {
  const key = await deriveKey(pin, salt);
  const iv  = window.crypto.getRandomValues(new Uint8Array(12));
  const enc = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { content: b64(enc), iv: b64(iv) };
};

const doDecrypt = async (content: string, iv: string, pin: string, salt: string): Promise<string | null> => {
  try {
    const key = await deriveKey(pin, salt);
    const dec = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(iv) }, key, ub64(content));
    return new TextDecoder().decode(dec);
  } catch { return null; }
};

// ─── Component ────────────────────────────────────────────────────────────────

type Screen = 'loading' | 'create-pin' | 'unlock' | 'vault';

export const SecureNotesVault = () => {
  const [screen,       setScreen]       = useState<Screen>('loading');
  const [userId,       setUserId]       = useState<string | null>(null);

  const [pin,          setPin]          = useState('');
  const [pinConfirm,   setPinConfirm]   = useState('');
  const activePinRef = useRef('');

  const [pinError,       setPinError]       = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked,       setIsLocked]       = useState(false);
  const [lastUnlockTime, setLastUnlockTime] = useState<Date | null>(null);

  const [notes,          setNotes]          = useState<EncryptedNote[]>([]);
  const [newNote,        setNewNote]        = useState('');
  const [decryptedNotes, setDecryptedNotes] = useState<Record<string, string>>({});
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');

  const [deleteConfirm,        setDeleteConfirm]        = useState<string | null>(null);
  const [showForgotPin,        setShowForgotPin]        = useState(false);
  const [forgotPinConfirmText, setForgotPinConfirmText] = useState('');
  const [forgotPinStep,        setForgotPinStep]        = useState<1 | 2>(1);

  const INACTIVITY_MS = 5 * 60 * 1000;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Init: get session → check PIN → decide screen ────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // supabase.auth.getSession() reads from localStorage — no network, instant
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        const uid = data?.session?.user?.id ?? null;
        if (!uid) {
          // No user logged in — show nothing useful
          setScreen('create-pin'); // will show "please sign in" via pinError
          setPinError('Please sign in to access your vault.');
          return;
        }

        setUserId(uid);

        // Check if vault was already unlocked this tab session
        const ssUid = sessionStorage.getItem(SS_UNLOCKED);
        const ssPin = sessionStorage.getItem(SS_PIN);
        if (ssUid === uid && ssPin) {
          activePinRef.current = ssPin;
          setLastUnlockTime(new Date());
          setScreen('vault');
          return;
        }

        // Check if PIN exists in DB
        const { data: pinData, error: pinErr } = await fetchPinHash(uid);
        if (cancelled) return;

        if (pinErr) {
          setPinError('Unable to reach vault. Check your connection.');
          setScreen('create-pin');
          return;
        }

        setScreen(pinData?.pin_hash ? 'unlock' : 'create-pin');
      } catch (e) {
        if (!cancelled) {
          setPinError('Vault init error: ' + String(e));
          setScreen('create-pin');
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Load notes when on vault screen ──────────────────────────────────────────
  const refreshNotes = useCallback(async () => {
    if (!userId) return;
    const { data } = await fetchEncryptedNotes(userId);
    setNotes(data || []);
  }, [userId]);

  useEffect(() => {
    if (screen !== 'vault' || !userId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await fetchEncryptedNotes(userId);
      if (error) { setError('Unable to load notes: ' + error.message); setNotes([]); }
      else        { setNotes(data || []); setDecryptedNotes({}); }
      setLoading(false);
    })();
  }, [screen, userId]);

  // ── Inactivity auto-lock ──────────────────────────────────────────────────────
  const lockVault = useCallback((reason?: string) => {
    setScreen('unlock');
    setPin('');
    activePinRef.current = '';
    setDecryptedNotes({});
    setPinError(reason ?? '');
    setFailedAttempts(0);
    sessionStorage.removeItem(SS_UNLOCKED);
    sessionStorage.removeItem(SS_PIN);
  }, []);

  useEffect(() => {
    if (screen !== 'vault') return;
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => lockVault('Session locked due to inactivity.'), INACTIVITY_MS);
    };
    window.addEventListener('click',    reset);
    window.addEventListener('keypress', reset);
    reset();
    return () => {
      window.removeEventListener('click',    reset);
      window.removeEventListener('keypress', reset);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [screen, lockVault]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const getPin = () => activePinRef.current || sessionStorage.getItem(SS_PIN) || '';

  const saveSession = (uid: string, p: string) => {
    activePinRef.current = p;
    sessionStorage.setItem(SS_UNLOCKED, uid);
    sessionStorage.setItem(SS_PIN, p);
  };

  // ── Create PIN ────────────────────────────────────────────────────────────────
  const handleCreatePin = async () => {
    setPinError('');
    if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      setPinError('PIN must be 4–6 digits only.'); return;
    }
    if (pin !== pinConfirm) { setPinError('PINs do not match.'); return; }
    if (!userId || loading) return;

    try {
      setLoading(true);
      const { error } = await savePinHash(userId, await hashPin(pin), 3);
      if (error) {
        setPinError('Failed to save PIN: ' + String(error.message || error)); return;
      }
      saveSession(userId, pin);
      setPin(''); setPinConfirm('');
      setLastUnlockTime(new Date());
      setScreen('vault');
    } catch (e) {
      setPinError('Error: ' + String(e));
    } finally { setLoading(false); }
  };

  // ── Unlock ────────────────────────────────────────────────────────────────────
  const handleUnlockVault = async () => {
    setPinError('');
    if (isLocked)        { setPinError('Too many failed attempts. Try again in 5 min.'); return; }
    if (!userId || !pin) { setPinError('Enter your PIN.'); return; }

    try {
      setLoading(true);
      const { data } = await fetchPinHash(userId);
      if (!data?.pin_hash) { setPinError('PIN not found. Create a new one.'); return; }

      if (await hashPin(pin) !== data.pin_hash) {
        const att = failedAttempts + 1;
        setFailedAttempts(att);
        if (att >= 5) {
          setIsLocked(true);
          setTimeout(() => { setIsLocked(false); setFailedAttempts(0); }, 5 * 60 * 1000);
          setPinError('Too many failed attempts. Locked for 5 minutes.');
        } else {
          setPinError(`Wrong PIN. ${5 - att} attempt${5 - att !== 1 ? 's' : ''} left.`);
        }
        return;
      }

      saveSession(userId, pin);
      setFailedAttempts(0);
      setLastUnlockTime(new Date());
      setPin('');
      setScreen('vault');
    } catch (e) {
      setPinError('Error: ' + String(e));
    } finally { setLoading(false); }
  };

  // ── Save note ─────────────────────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!userId) return;
    if (!newNote.trim()) { setError('Please type a note.'); return; }
    const p = getPin();
    if (!p) { setError('Session expired. Lock and re-unlock vault.'); return; }

    try {
      setLoading(true); setError('');
      const salt = notes.length > 0 ? notes[0].salt : generateSalt();
      const enc  = await doEncrypt(newNote.trim(), p, salt);
      const { error } = await saveEncryptedNote(userId, enc.content, enc.iv, salt);
      if (error) { setError('Failed to save: ' + error.message); return; }
      setNewNote('');
      await refreshNotes();
    } catch (e) { setError('Error: ' + String(e)); }
    finally     { setLoading(false); }
  };

  // ── Decrypt note ──────────────────────────────────────────────────────────────
  const handleDecryptNote = async (note: EncryptedNote) => {
    const p = getPin();
    if (!p) { setError('Session expired. Lock and re-unlock vault.'); return; }
    const dec = await doDecrypt(note.encrypted_content, note.iv, p, note.salt);
    if (dec === null) { setError('Decrypt failed. Wrong PIN?'); return; }
    setDecryptedNotes(prev => ({ ...prev, [note.id]: dec }));
    setError('');
  };

  const handleHideNote = (id: string) =>
    setDecryptedNotes(prev => { const u = { ...prev }; delete u[id]; return u; });

  // ── Delete note ───────────────────────────────────────────────────────────────
  const handleDeleteNote = async (noteId: string) => {
    if (!userId) return;
    try {
      setLoading(true);
      const { error } = await deleteEncryptedNote(noteId);
      if (error) { setError('Delete failed: ' + error.message); return; }
      setDeleteConfirm(null);
      handleHideNote(noteId);
      await refreshNotes();
    } catch (e) { setError('Error: ' + String(e)); }
    finally     { setLoading(false); }
  };

  // ── Forgot PIN ────────────────────────────────────────────────────────────────
  const handleForgotPin = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const { error: e1 } = await deleteAllUserNotes(userId); if (e1) throw e1;
      const { error: e2 } = await deletePinHash(userId);      if (e2) throw e2;
      sessionStorage.removeItem(SS_UNLOCKED);
      sessionStorage.removeItem(SS_PIN);
      activePinRef.current = '';
      setNotes([]); setDecryptedNotes({});
      setPin(''); setPinConfirm('');
      setShowForgotPin(false); setForgotPinStep(1); setForgotPinConfirmText('');
      setPinError('Vault reset. Create a new PIN to continue.');
      setScreen('create-pin');
    } catch (e) { setPinError('Reset failed: ' + String(e)); }
    finally     { setLoading(false); }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────────

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (screen === 'loading') {
    return (
      <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-cyan-400 animate-pulse" />
          <h3 className="text-xl font-semibold text-white">Secure Notes Vault</h3>
        </div>
      </div>
    );
  }

  // ── Create PIN ───────────────────────────────────────────────────────────────
  if (screen === 'create-pin') {
    return (
      <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-6 h-6 text-cyan-400" />
          <h3 className="text-2xl font-bold text-white">Secure Notes Vault</h3>
        </div>
        <p className="text-gray-400 text-xs mb-6">End-to-end encrypted • PIN never leaves your device</p>

        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-rose-400" />
          <h4 className="text-lg font-semibold text-white">Create Your Vault PIN</h4>
        </div>
        <p className="text-gray-300 text-sm mb-5">
          Choose a 4–6 digit PIN to encrypt your notes. This PIN is required to view your notes — it is never stored on any server.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">PIN (4–6 digits)</label>
            <input
              type="password" inputMode="numeric" maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleCreatePin()}
              placeholder="••••••"
              autoFocus
              className="w-full bg-gray-800/60 border border-cyan-500/30 rounded-lg px-4 py-3 text-white text-2xl tracking-[0.5em] focus:border-cyan-400 focus:outline-none transition placeholder:text-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Confirm PIN</label>
            <input
              type="password" inputMode="numeric" maxLength={6}
              value={pinConfirm}
              onChange={e => setPinConfirm(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleCreatePin()}
              placeholder="••••••"
              className="w-full bg-gray-800/60 border border-cyan-500/30 rounded-lg px-4 py-3 text-white text-2xl tracking-[0.5em] focus:border-cyan-400 focus:outline-none transition placeholder:text-gray-600"
            />
          </div>

          {pinError && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {pinError}
            </div>
          )}

          <button
            onClick={handleCreatePin}
            disabled={!pin || !pinConfirm || loading}
            className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition hover:opacity-90 text-base"
          >
            {loading ? 'Creating vault...' : '🔐 Create PIN & Open Vault'}
          </button>
        </div>

        <p className="text-xs text-gray-600 mt-4 text-center">
          ⚠️ If you forget your PIN, all notes will be permanently deleted. There is no recovery option.
        </p>
      </div>
    );
  }

  // ── Unlock ───────────────────────────────────────────────────────────────────
  if (screen === 'unlock') {
    return (
      <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-6 h-6 text-cyan-400" />
          <h3 className="text-2xl font-bold text-white">Secure Notes Vault</h3>
        </div>
        <p className="text-gray-400 text-xs mb-6">End-to-end encrypted • PIN never leaves your device</p>

        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-yellow-400" />
          <h4 className="text-lg font-semibold text-white">Enter PIN to Unlock</h4>
        </div>

        <div className="space-y-4">
          <input
            type="password" inputMode="numeric" maxLength={6}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && !isLocked && handleUnlockVault()}
            placeholder="••••••"
            disabled={isLocked}
            autoFocus
            className="w-full bg-gray-800/60 border border-cyan-500/30 rounded-lg px-4 py-4 text-white text-3xl tracking-[0.6em] text-center focus:border-cyan-400 focus:outline-none transition disabled:opacity-40 disabled:cursor-not-allowed placeholder:text-gray-600"
          />

          {pinError && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {pinError}
            </div>
          )}

          <button
            onClick={handleUnlockVault}
            disabled={!pin || isLocked || loading}
            className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition hover:opacity-90 text-base"
          >
            {loading ? 'Unlocking...' : '🔓 Unlock Vault'}
          </button>

          <button
            onClick={() => { setShowForgotPin(true); setForgotPinStep(1); setForgotPinConfirmText(''); }}
            className="w-full text-sm text-gray-500 hover:text-gray-300 transition pt-1"
          >
            Forgot PIN?
          </button>
        </div>

        {/* Forgot PIN Modal */}
        {showForgotPin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 border border-red-500/40 rounded-xl p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <h4 className="text-lg font-semibold text-white">Reset Vault?</h4>
              </div>
              {forgotPinStep === 1 ? (
                <>
                  <p className="text-sm text-gray-300 mb-3">⚠️ This will permanently:</p>
                  <ul className="text-sm text-red-300 space-y-1 mb-5 list-disc list-inside">
                    <li>Delete ALL your encrypted notes</li>
                    <li>Remove your current PIN</li>
                    <li>This CANNOT be undone</li>
                  </ul>
                  <div className="flex gap-3">
                    <button onClick={() => setShowForgotPin(false)} className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition text-sm">Cancel</button>
                    <button onClick={() => setForgotPinStep(2)} className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition text-sm font-semibold">I understand, continue</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-300 mb-3">Type <strong className="text-white">DELETE</strong> to confirm:</p>
                  <input
                    type="text" placeholder="Type DELETE"
                    value={forgotPinConfirmText}
                    onChange={e => setForgotPinConfirmText(e.target.value)}
                    className="w-full bg-gray-800/60 border border-red-500/30 rounded-lg px-3 py-2 text-white mb-4 focus:border-red-400 focus:outline-none transition"
                  />
                  <div className="flex gap-3">
                    <button onClick={() => { setForgotPinStep(1); setForgotPinConfirmText(''); setShowForgotPin(false); }} className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition text-sm">Cancel</button>
                    <button
                      onClick={handleForgotPin}
                      disabled={forgotPinConfirmText !== 'DELETE' || loading}
                      className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    >{loading ? 'Resetting...' : 'Reset Vault'}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Vault (unlocked) ─────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Unlock className="w-6 h-6 text-green-400" />
          <div>
            <h3 className="text-2xl font-bold text-white">Secure Notes Vault</h3>
            <p className="text-xs text-gray-400">🔓 Unlocked{lastUnlockTime && ` • ${lastUnlockTime.toLocaleTimeString()}`}</p>
          </div>
        </div>
        <button
          onClick={() => lockVault()}
          className="px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/30 transition text-sm flex items-center gap-2"
        >
          <Lock className="w-4 h-4" /> Lock
        </button>
      </div>

      {/* Add Note */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-cyan-400" />
          <h4 className="text-sm font-semibold text-white">Add New Note</h4>
        </div>
        <textarea
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          placeholder="Type your secure note here..."
          className="w-full h-24 bg-gray-800/60 border border-cyan-500/30 rounded-lg p-3 text-white focus:border-cyan-400 focus:outline-none transition resize-none"
        />
        <button
          onClick={handleSaveNote}
          disabled={!newNote.trim() || loading}
          className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition hover:opacity-90"
        >
          {loading ? 'Saving...' : 'Save Encrypted Note'}
        </button>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Notes List */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          {notes.length === 0 ? 'No notes yet' : `${notes.length} Encrypted Note${notes.length !== 1 ? 's' : ''}`}
        </h4>

        {loading && notes.length === 0 && (
          <p className="text-xs text-gray-500 italic">Loading notes...</p>
        )}

        {notes.map(note => (
          <div key={note.id} className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs text-gray-500">{new Date(note.created_at).toLocaleString()}</p>
              <div className="flex items-center gap-2">
                {decryptedNotes[note.id] ? (
                  <button onClick={() => handleHideNote(note.id)} className="text-cyan-400 hover:text-cyan-200 text-xs flex items-center gap-1 transition border border-cyan-500/30 rounded px-2 py-1">
                    <EyeOff className="w-3 h-3" /> Hide
                  </button>
                ) : (
                  <button onClick={() => handleDecryptNote(note)} className="text-cyan-400 hover:text-cyan-200 text-xs flex items-center gap-1 transition border border-cyan-500/30 rounded px-2 py-1">
                    <Eye className="w-3 h-3" /> View
                  </button>
                )}
                <button onClick={() => setDeleteConfirm(note.id)} className="text-red-400 hover:text-red-200 text-xs flex items-center gap-1 transition border border-red-500/30 rounded px-2 py-1">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
            <div className="text-sm break-words p-3 bg-gray-900/60 rounded-lg border border-gray-700/50 max-h-40 overflow-y-auto">
              {decryptedNotes[note.id]
                ? <span className="text-gray-200">{decryptedNotes[note.id]}</span>
                : <span className="text-gray-600 italic flex items-center gap-2"><Lock className="w-3 h-3" /> Encrypted — click View to decrypt</span>
              }
            </div>
          </div>
        ))}
      </div>

      {/* Delete Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-500/40 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h4 className="text-lg font-semibold text-white mb-2">Delete Note?</h4>
            <p className="text-sm text-gray-400 mb-5">This encrypted note will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition text-sm">Cancel</button>
              <button onClick={() => handleDeleteNote(deleteConfirm)} disabled={loading}
                className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                {loading ? 'Deleting...' : 'Delete Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};