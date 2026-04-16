import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Shield, Lock, Unlock, Trash2, Plus, AlertTriangle, Eye, EyeOff, Settings,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface EncryptedNote {
  id: string;
  user_id: string;
  encrypted_content: string;
  iv: string;
  salt: string;
  created_at: string;
}

interface SecureNotesVaultProps {
  userId?: string;
  userEmail?: string;
}

// ─── Session Storage Keys ────────────────────────────────────────────────────
const SS_UNLOCKED = 'vnote_unlocked';
const SS_PIN      = 'vnote_pin';

// ─── Crypto Helpers ──────────────────────────────────────────────────────────
const generateSalt = (): string =>
  btoa(String.fromCharCode(...window.crypto.getRandomValues(new Uint8Array(16))));

const deriveKey = async (pin: string, salt: string): Promise<CryptoKey> => {
  const base = await window.crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await window.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: Uint8Array.from(atob(salt), c => c.charCodeAt(0)), iterations: 100_000, hash: 'SHA-256' },
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

// ─── Supabase Helpers — vault_pins ───────────────────────────────────────────
const fetchPinRow = async (userId: string) => {
  try {
    return await supabase
      .from('vault_pins')
      .select('id, pin_hash')
      .eq('user_id', userId)
      .maybeSingle();
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
};

const upsertPinHash = async (userId: string, pinHash: string, retries = 3) => {
  let lastError = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('vault_pins')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchErr && !fetchErr.message.includes('Lock')) {
        return { error: fetchErr };
      }

      if (existing?.id) {
        const { error } = await supabase
          .from('vault_pins')
          .update({ pin_hash: pinHash, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (!error) return { error: null };
        lastError = error;
      } else {
        const { error } = await supabase
          .from('vault_pins')
          .insert({ user_id: userId, pin_hash: pinHash });
        if (!error) return { error: null };
        lastError = error;
      }

      // If it's a lock error, wait and retry
      if (lastError?.message?.includes('Lock')) {
        console.warn(`[Vault] Lock conflict on attempt ${attempt + 1}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
        continue;
      }
      
      return { error: lastError };
    } catch (e) {
      lastError = e;
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }

  return { error: lastError };
};

const deletePinRow = (userId: string) =>
  supabase.from('vault_pins').delete().eq('user_id', userId);

// ─── Supabase Helpers — encrypted_notes ───────────────────────────────────────
const fetchNotes = (userId: string) =>
  supabase
    .from('encrypted_notes')
    .select('id, user_id, encrypted_content, iv, salt, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

const insertNote = (userId: string, encrypted_content: string, iv: string, salt: string) =>
  supabase.from('encrypted_notes').insert({ user_id: userId, encrypted_content, iv, salt });

const removeNote = (noteId: string) =>
  supabase.from('encrypted_notes').delete().eq('id', noteId);

const removeAllNotes = (userId: string) =>
  supabase.from('encrypted_notes').delete().eq('user_id', userId);

// ─── PinPad ───────────────────────────────────────────────────────────────────
interface PinPadProps {
  title: string;
  subtitle?: string;
  onComplete: (pin: string) => void;
  error?: string;
  loading?: boolean;
  onOptionsClick?: () => void;
  showOptions?: boolean;
}

const PinPad = ({ title, subtitle, onComplete, error, loading, onOptionsClick, showOptions }: PinPadProps) => {
  const [entered, setEntered] = useState('');
  const MAX = 4;
  const submittedRef = useRef(false);

  useEffect(() => {
    if (error) { setEntered(''); submittedRef.current = false; }
  }, [error]);

  const handleKey = useCallback((k: string) => {
    if (loading || submittedRef.current) return;
    if (k === 'del') { setEntered(p => p.slice(0, -1)); return; }
    if (entered.length >= MAX) return;
    const next = entered + k;
    setEntered(next);
    if (next.length === MAX) {
      submittedRef.current = true;
      setTimeout(() => {
        onComplete(next);
        setEntered('');
        submittedRef.current = false;
      }, 150);
    }
  }, [entered, loading, onComplete]);

  const keys = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','del']];

  return (
    <div style={S.pinWrap}>
      <div style={S.pinHeader}>
        <div style={S.pinShieldWrap}><Shield size={28} color="#e63950" /></div>
        <div style={S.pinTitle}>{title}</div>
        {subtitle && <div style={S.pinSubtitle}>{subtitle}</div>}
      </div>
      <div style={S.dotsRow}>
        {Array.from({ length: MAX }).map((_, i) => (
          <div key={i} style={{ ...S.dot, ...(i < entered.length ? S.dotFilled : {}) }} />
        ))}
      </div>
      {error && (
        <div style={S.pinError}>
          <AlertTriangle size={13} color="#e63950" /><span>{error}</span>
        </div>
      )}
      {loading && <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>Please wait...</div>}
      <div style={S.keypad}>
        {keys.map((row, ri) => (
          <div key={ri} style={S.keyRow}>
            {row.map((k, ki) => {
              if (!k) return <div key={ki} style={S.keyEmpty} />;
              if (k === 'del') return (
                <button key={ki} style={S.keyDel} onClick={() => handleKey('del')} disabled={loading}>
                  <span style={{ fontSize: 20, color: '#e63950' }}>⌫</span>
                </button>
              );
              return (
                <button key={ki} style={S.keyBtn} onClick={() => handleKey(k)} disabled={loading}>
                  <span style={S.keyNum}>{k}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {showOptions && onOptionsClick && (
        <button style={S.optionsBtn} onClick={onOptionsClick}>Options</button>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
type Screen = 'loading' | 'create-pin' | 'confirm-pin' | 'unlock' | 'vault';
type Modal  = null | 'options' | 'change-current' | 'change-new' | 'change-confirm' | 'forgot';

export const SecureNotesVault = ({ userId, userEmail }: SecureNotesVaultProps) => {
  const [screen,         setScreen]         = useState<Screen>('loading');
  const [modal,          setModal]          = useState<Modal>(null);
  const [pinError,       setPinError]       = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked,       setIsLocked]       = useState(false);
  const [lastUnlockTime, setLastUnlockTime] = useState<Date | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [flashMsg,       setFlashMsg]       = useState('');
  const [flashType,      setFlashType]      = useState<'ok' | 'err'>('ok');
  const [notes,          setNotes]          = useState<EncryptedNote[]>([]);
  const [newNote,        setNewNote]        = useState('');
  const [decryptedNotes, setDecryptedNotes] = useState<Record<string, string>>({});
  const [deleteTarget,   setDeleteTarget]   = useState<string | null>(null);
  const [changePinError, setChangePinError] = useState('');
  const [newPinTemp,     setNewPinTemp]     = useState('');
  const [forgotPw,       setForgotPw]       = useState('');
  const [forgotError,    setForgotError]    = useState('');
  const [forgotLoading,  setForgotLoading]  = useState(false);
  const [showForgotPw,   setShowForgotPw]   = useState(false);
  const [firstPin,       setFirstPin]       = useState('');
  const [pinKey,         setPinKey]         = useState(0);

  // ✅ useAuth bilkul nahi — directly supabase session
  const activePinRef  = useRef('');
  const userIdRef     = useRef<string>('');
  const userEmailRef  = useRef<string>('');
  const processingRef = useRef(false);
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const INACTIVITY    = 5 * 60 * 1000;

  const flash = (msg: string, type: 'ok' | 'err' = 'ok', ms = 2500) => {
    setFlashMsg(msg); setFlashType(type);
    setTimeout(() => setFlashMsg(''), ms);
  };

  // ─── Init: directly Supabase getSession / Props-based fallback ───────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        if (userId) {
          userIdRef.current = userId;
          userEmailRef.current = userEmail ?? '';
          console.log('[Vault] User props provided:', userEmail, userId);
        } else {
          // ✅ useAuth/AuthContext NAHI — seedha Supabase se session lo
          const { data: { session }, error } = await supabase.auth.getSession();
          if (cancelled) return;

          if (error || !session?.user) {
            console.warn('[Vault] No session found');
            setScreen('create-pin');
            return;
          }

          userIdRef.current = session.user.id;
          userEmailRef.current = session.user.email ?? '';
          console.log('[Vault] Session found:', userEmailRef.current, userIdRef.current);
        }

        const uid = userIdRef.current;
        if (!uid) {
          console.warn('[Vault] No user id set');
          setScreen('create-pin');
          return;
        }

        // Fast path — session storage
        const ssUid = sessionStorage.getItem(SS_UNLOCKED);
        const ssPin = sessionStorage.getItem(SS_PIN);
        if (ssUid === uid && ssPin) {
          activePinRef.current = ssPin;
          setLastUnlockTime(new Date());
          setScreen('vault');
          return;
        }

        // PIN check
        const { data: pinRow, error: pinErr } = await fetchPinRow(uid);
        if (cancelled) return;

        if (pinErr) {
          console.error('[Vault] PIN fetch error:', pinErr.message);
          setScreen('create-pin');
          return;
        }

        console.log('[Vault] pinRow found:', pinRow);
        setScreen(pinRow?.pin_hash ? 'unlock' : 'create-pin');

      } catch (err) {
        if (!cancelled) {
          console.error('[Vault] Init error:', err);
          setScreen('create-pin');
        }
      }
    };

    init();

    return () => { cancelled = true; };
  }, []);

  // ─── Load notes ───────────────────────────────────────────────────────────
  const refreshNotes = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    const { data } = await fetchNotes(uid);
    setNotes((data as EncryptedNote[]) || []);
  }, []);

  useEffect(() => {
    if (screen !== 'vault') return;
    const uid = userIdRef.current;
    if (!uid) return;
    (async () => {
      setLoading(true);
      const { data, error } = await fetchNotes(uid);
      if (error) flash('Notes load failed: ' + error.message, 'err');
      else { setNotes((data as EncryptedNote[]) || []); setDecryptedNotes({}); }
      setLoading(false);
    })();
  }, [screen]);

  // ─── Inactivity lock ──────────────────────────────────────────────────────
  const lockVault = useCallback((reason?: string) => {
    setScreen('unlock');
    activePinRef.current = '';
    setDecryptedNotes({});
    setPinError(reason ?? '');
    setFailedAttempts(0);
    sessionStorage.removeItem(SS_UNLOCKED);
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
    return () => {
      window.removeEventListener('click', reset);
      window.removeEventListener('keypress', reset);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [screen, lockVault]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const saveSession = (uid: string, p: string) => {
    activePinRef.current = p;
    sessionStorage.setItem(SS_UNLOCKED, uid);
    sessionStorage.setItem(SS_PIN, p);
  };

  const getPin = () => activePinRef.current || sessionStorage.getItem(SS_PIN) || '';

  // ─── PIN Creation ─────────────────────────────────────────────────────────
  const handleCreatePin = useCallback((pin: string) => {
    if (processingRef.current) return;
    console.log('[Vault] Step 1: First PIN entered');
    setPinError('');
    setFirstPin(pin);
    setPinKey(k => k + 1);
    setScreen('confirm-pin');
  }, []);

  const handleConfirmPin = useCallback(async (pin: string) => {
    if (processingRef.current) return;
    
    if (pin !== firstPin) {
      setPinError("PINs don't match. Try again.");
      setFirstPin('');
      setPinKey(k => k + 1);
      setScreen('create-pin');
      return;
    }

    // ✅ Session fresh lo agar userIdRef empty hai
    let uid = userIdRef.current;
    if (!uid) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          uid = session.user.id;
          userIdRef.current    = uid;
          userEmailRef.current = session.user.email ?? '';
        } else {
          setPinError('Not signed in. Please login again.');
          return;
        }
      } catch (sessionErr) {
        setPinError('Failed to verify session. Please try again.');
        return;
      }
    }

    processingRef.current = true;
    setLoading(true);
    setPinError('');

    try {
      console.log('[Vault] Step 2: Saving PIN for:', uid);
      const pinHash = await hashPin(pin);
      const { error } = await upsertPinHash(uid, pinHash);

      if (error) {
        console.error('[Vault] PIN save error:', error);
        const errMsg = (error as any).message || String(error);
        if (errMsg.includes('Lock')) {
          setPinError('Server busy. Please try again.');
        } else {
          setPinError('Failed to save PIN: ' + errMsg);
        }
        setFirstPin('');
        setPinKey(k => k + 1);
        setScreen('create-pin');
        return;
      }

      console.log('[Vault] ✅ PIN saved! Opening vault...');
      saveSession(uid, pin);
      setFirstPin('');
      setLastUnlockTime(new Date());
      setPinKey(k => k + 1);
      setScreen('vault');

    } catch (e) {
      console.error('[Vault] Confirm PIN exception:', e);
      setPinError('Error: ' + String(e));
      setFirstPin('');
      setPinKey(k => k + 1);
      setScreen('create-pin');
    } finally {
      setLoading(false);
      processingRef.current = false;
    }
  }, [firstPin]);

  // ─── Unlock ───────────────────────────────────────────────────────────────
  const handleUnlock = useCallback(async (pin: string) => {
    if (processingRef.current) return;
    if (isLocked) { setPinError('Too many attempts. Wait 5 min.'); return; }

    const uid = userIdRef.current;
    if (!uid) { setPinError('Not signed in.'); return; }

    processingRef.current = true;
    setLoading(true);
    setPinError('');

    try {
      const { data: pinRow, error } = await fetchPinRow(uid);
      if (error) { setPinError('Error fetching PIN.'); return; }
      if (!pinRow?.pin_hash) { setScreen('create-pin'); return; }

      if (await hashPin(pin) !== pinRow.pin_hash) {
        const att = failedAttempts + 1;
        setFailedAttempts(att);
        setPinKey(k => k + 1);
        if (att >= 5) {
          setIsLocked(true);
          setTimeout(() => { setIsLocked(false); setFailedAttempts(0); }, 5 * 60 * 1000);
          setPinError('Locked 5 min — too many failed attempts.');
        } else {
          setPinError(`Wrong PIN. ${5 - att} attempt${5 - att !== 1 ? 's' : ''} left.`);
        }
        return;
      }

      saveSession(uid, pin);
      setFailedAttempts(0);
      setLastUnlockTime(new Date());
      setScreen('vault');

    } catch (e) {
      setPinError('Error: ' + String(e));
      setPinKey(k => k + 1);
    } finally {
      setLoading(false);
      processingRef.current = false;
    }
  }, [isLocked, failedAttempts]);

  // ─── Change PIN ───────────────────────────────────────────────────────────
  const handleChangeVerifyCurrent = async (pin: string) => {
    const uid = userIdRef.current;
    if (!uid) return;
    setChangePinError(''); setLoading(true);
    try {
      const { data } = await fetchPinRow(uid);
      if (!data?.pin_hash || await hashPin(pin) !== data.pin_hash) {
        setChangePinError('Wrong current PIN.'); setPinKey(k => k + 1); return;
      }
      setModal('change-new');
    } catch (e) { setChangePinError('Error: ' + String(e)); }
    finally { setLoading(false); }
  };

  const handleChangeNewPin = (pin: string) => {
    setNewPinTemp(pin); setModal('change-confirm'); setChangePinError('');
  };

  const handleChangeConfirmPin = async (pin: string) => {
    if (pin !== newPinTemp) {
      setChangePinError("PINs don't match.");
      setModal('change-new'); setNewPinTemp(''); return;
    }
    const uid = userIdRef.current;
    if (!uid) return;
    setLoading(true); setChangePinError('');
    try {
      const oldPin = getPin();
      const { data: notesData } = await fetchNotes(uid);
      const allNotes = (notesData as EncryptedNote[]) || [];
      for (const note of allNotes) {
        const dec = await doDecrypt(note.encrypted_content, note.iv, oldPin, note.salt);
        if (dec === null) continue;
        const newSalt = generateSalt();
        const enc = await doEncrypt(dec, pin, newSalt);
        await removeNote(note.id);
        await insertNote(uid, enc.content, enc.iv, newSalt);
      }
      await upsertPinHash(uid, await hashPin(pin));
      saveSession(uid, pin);
      setNewPinTemp(''); setModal(null);
      await refreshNotes();
      flash('✅ PIN changed successfully!');
    } catch (e) { setChangePinError('Error: ' + String(e)); }
    finally { setLoading(false); }
  };

  // ─── Forgot / Reset ───────────────────────────────────────────────────────
  const handleForgotReset = async () => {
    if (!forgotPw.trim()) { setForgotError('Enter your account password.'); return; }
    const uid   = userIdRef.current;
    const email = userEmailRef.current;
    if (!email || !uid) { setForgotError('User not found.'); return; }
    setForgotLoading(true); setForgotError('');
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: forgotPw });
      if (authErr) { setForgotError('Wrong password. Try again.'); return; }
      await removeAllNotes(uid);
      await deletePinRow(uid);
      sessionStorage.removeItem(SS_UNLOCKED);
      sessionStorage.removeItem(SS_PIN);
      activePinRef.current = '';
      setNotes([]); setDecryptedNotes({});
      setForgotPw(''); setModal(null);
      setPinError('Vault reset. Create a new PIN.');
      setFirstPin('');
      setPinKey(k => k + 1);
      setScreen('create-pin');
    } catch (e) { setForgotError('Error: ' + String(e)); }
    finally { setForgotLoading(false); }
  };

  // ─── Notes ────────────────────────────────────────────────────────────────
  const handleSaveNote = async () => {
    const uid = userIdRef.current;
    if (!uid || !newNote.trim()) { flash('Type a note first.', 'err'); return; }
    const p = getPin();
    if (!p) { flash('Session expired. Re-unlock.', 'err'); return; }
    try {
      setLoading(true);
      const salt = generateSalt();
      const enc  = await doEncrypt(newNote.trim(), p, salt);
      const { error } = await insertNote(uid, enc.content, enc.iv, salt);
      if (error) { flash('Save failed: ' + error.message, 'err'); return; }
      setNewNote(''); await refreshNotes(); flash('Note saved!');
    } catch (e) { flash('Error: ' + String(e), 'err'); }
    finally { setLoading(false); }
  };

  const handleDecryptNote = async (note: EncryptedNote) => {
    const p = getPin();
    if (!p) { flash('Session expired.', 'err'); return; }
    const dec = await doDecrypt(note.encrypted_content, note.iv, p, note.salt);
    if (dec === null) { flash('Decrypt failed. Wrong PIN?', 'err'); return; }
    setDecryptedNotes(prev => ({ ...prev, [note.id]: dec }));
  };

  const handleHideNote = (id: string) =>
    setDecryptedNotes(prev => { const u = { ...prev }; delete u[id]; return u; });

  const handleDeleteNote = async (noteId: string) => {
    try {
      setLoading(true);
      await removeNote(noteId);
      setDeleteTarget(null); handleHideNote(noteId); await refreshNotes();
    } catch (e) { flash('Error: ' + String(e), 'err'); }
    finally { setLoading(false); }
  };

  // ─── Sub-components ───────────────────────────────────────────────────────
  const OptionsModal = ({ fromVault = false }) => (
    <div style={S.modalBackdrop}>
      <div style={S.optionsModal}>
        <div style={S.optionsTitle}>{fromVault ? 'Vault Options' : 'Options'}</div>
        <button style={S.optionBtn} onClick={() => { setModal('change-current'); setChangePinError(''); }}>
          Change Passcode
        </button>
        <button
          style={{ ...S.optionBtn, ...(fromVault ? { color: '#e63950', borderColor: '#e63950' } : {}) }}
          onClick={() => { setModal('forgot'); setForgotError(''); setForgotPw(''); }}>
          {fromVault ? 'Reset Vault' : 'Forgot Passcode'}
        </button>
        <button style={S.optionCancelBtn} onClick={() => setModal(null)}>Cancel</button>
      </div>
    </div>
  );

  const ChangePinModals = () => (
    <>
      {modal === 'change-current' && (
        <div style={S.modalBackdrop}><div style={S.pinModalWrap}>
          <PinPad key={`cc-${pinKey}`} title="Current PIN" subtitle="Enter your current passcode"
            onComplete={handleChangeVerifyCurrent} error={changePinError} loading={loading} />
          <button style={S.cancelLink} onClick={() => setModal(null)}>Cancel</button>
        </div></div>
      )}
      {modal === 'change-new' && (
        <div style={S.modalBackdrop}><div style={S.pinModalWrap}>
          <PinPad key={`cn-${pinKey}`} title="New PIN" subtitle="Choose a new 4-digit passcode"
            onComplete={handleChangeNewPin} error={changePinError} loading={loading} />
          <button style={S.cancelLink} onClick={() => setModal(null)}>Cancel</button>
        </div></div>
      )}
      {modal === 'change-confirm' && (
        <div style={S.modalBackdrop}><div style={S.pinModalWrap}>
          <PinPad key={`cf-${pinKey}`} title="Confirm New PIN" subtitle="Re-enter your new passcode"
            onComplete={handleChangeConfirmPin} error={changePinError} loading={loading} />
          <button style={S.cancelLink} onClick={() => setModal(null)}>Cancel</button>
        </div></div>
      )}
    </>
  );

  const ForgotModal = () => (
    <div style={S.modalBackdrop}>
      <div style={S.forgotModal}>
        <div style={S.forgotIcon}>⚠️</div>
        <div style={S.forgotTitle}>Reset Vault</div>
        <div style={S.forgotBody}>
          Enter your <strong>AxelleVault account password</strong> to verify.<br /><br />
          <span style={{ color: '#e63950' }}>All notes will be permanently deleted.</span>
        </div>
        <input
          type={showForgotPw ? 'text' : 'password'}
          placeholder="Account password"
          value={forgotPw}
          onChange={e => setForgotPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleForgotReset()}
          style={S.forgotInput}
        />
        <button style={S.showPwBtn} onClick={() => setShowForgotPw(v => !v)}>
          {showForgotPw ? '🙈 Hide' : '👁 Show'}
        </button>
        {forgotError && (
          <div style={S.forgotError}><AlertTriangle size={13} color="#e63950" /> {forgotError}</div>
        )}
        <button
          style={{ ...S.optionBtn, background: '#e63950', color: '#fff', marginTop: 12 }}
          onClick={handleForgotReset} disabled={forgotLoading}>
          {forgotLoading ? 'Verifying...' : '🗑 Reset Vault'}
        </button>
        <button style={S.optionCancelBtn} onClick={() => { setModal(null); setForgotPw(''); }}>Cancel</button>
      </div>
    </div>
  );

  // ─── Screens ──────────────────────────────────────────────────────────────
  if (screen === 'loading') {
    return (
      <div style={S.loadingWrap}>
        <Shield size={32} color="#e63950" />
        <div style={S.loadingText}>Initializing Vault...</div>
      </div>
    );
  }

  if (screen === 'create-pin') {
    return (
      <PinPad
        key={`create-${pinKey}`}
        title="Create Your PIN"
        subtitle="Choose a 4-digit PIN to protect your vault"
        onComplete={handleCreatePin}
        error={pinError}
        loading={loading}
      />
    );
  }

  if (screen === 'confirm-pin') {
    return (
      <PinPad
        key={`confirm-${pinKey}`}
        title="Confirm Your PIN"
        subtitle="Enter the same PIN again"
        onComplete={handleConfirmPin}
        error={pinError}
        loading={loading}
      />
    );
  }

  if (screen === 'unlock') {
    return (
      <>
        <PinPad
          key={`unlock-${pinKey}`}
          title="Enter PIN"
          subtitle="Vault is locked"
          onComplete={handleUnlock}
          error={pinError}
          loading={loading || isLocked}
          showOptions
          onOptionsClick={() => setModal('options')}
        />
        {modal === 'options' && <OptionsModal />}
        {modal === 'forgot'  && <ForgotModal />}
        <ChangePinModals />
      </>
    );
  }

  // ─── Vault Screen ─────────────────────────────────────────────────────────
  return (
    <div style={S.vaultWrap}>
      <div style={S.vaultHeader}>
        <div style={S.vaultHeaderLeft}>
          <Unlock size={20} color="#4ade80" />
          <div>
            <div style={S.vaultTitle}>Secure Notes Vault</div>
            <div style={S.vaultUnlockTime}>
              🔓 Unlocked{lastUnlockTime && ` · ${lastUnlockTime.toLocaleTimeString()}`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.settingsBtn} onClick={() => { setModal('options'); setChangePinError(''); }}>
            <Settings size={15} />
          </button>
          <button style={S.lockBtn} onClick={() => lockVault()}>
            <Lock size={14} /> Lock
          </button>
        </div>
      </div>

      <div style={S.addNoteBox}>
        <div style={S.addNoteLabel}><Plus size={14} color="#22d3ee" /> New Note</div>
        <textarea
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          placeholder="Type your secure note here..."
          style={S.textarea}
        />
        <button onClick={handleSaveNote} disabled={!newNote.trim() || loading} style={S.saveBtn}>
          {loading ? 'Saving...' : 'Save Encrypted Note'}
        </button>
      </div>

      {flashMsg && (
        <div style={flashType === 'ok' ? S.successMsg : S.errorMsg}>
          {flashType === 'err' && <AlertTriangle size={14} />} {flashMsg}
        </div>
      )}

      <div style={S.notesLabel}>
        {notes.length === 0 ? 'No notes yet' : `${notes.length} Encrypted Note${notes.length !== 1 ? 's' : ''}`}
      </div>
      {loading && notes.length === 0 && <div style={S.loadingSmall}>Loading notes...</div>}

      <div style={S.notesList}>
        {notes.map(note => (
          <div key={note.id} style={S.noteCard}>
            <div style={S.noteCardTop}>
              <span style={S.noteDate}>{new Date(note.created_at).toLocaleString()}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {decryptedNotes[note.id]
                  ? <button style={S.noteBtn} onClick={() => handleHideNote(note.id)}><EyeOff size={12} /> Hide</button>
                  : <button style={S.noteBtn} onClick={() => handleDecryptNote(note)}><Eye size={12} /> View</button>}
                <button style={{ ...S.noteBtn, ...S.noteBtnRed }} onClick={() => setDeleteTarget(note.id)}>
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
            <div style={S.noteContent}>
              {decryptedNotes[note.id]
                ? <span style={{ color: '#e2e8f0' }}>{decryptedNotes[note.id]}</span>
                : <span style={S.noteEncrypted}><Lock size={12} /> Encrypted — tap View to decrypt</span>}
            </div>
          </div>
        ))}
      </div>

      {modal === 'options' && <OptionsModal fromVault />}
      {modal === 'forgot'  && <ForgotModal />}
      <ChangePinModals />

      {deleteTarget && (
        <div style={S.modalBackdrop}>
          <div style={S.forgotModal}>
            <div style={S.forgotTitle}>Delete Note?</div>
            <div style={S.forgotBody}>This encrypted note will be permanently deleted.</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={S.optionCancelBtn} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                style={{ ...S.optionBtn, background: '#e63950', color: '#fff', flex: 1 }}
                onClick={() => handleDeleteNote(deleteTarget)} disabled={loading}>
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  pinWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100%', background: '#0a0a0a', padding: '32px 16px 24px', fontFamily: "'SF Pro Display', -apple-system, sans-serif" },
  pinHeader: { textAlign: 'center', marginBottom: 32 },
  pinShieldWrap: { width: 60, height: 60, borderRadius: '50%', background: 'rgba(230,57,80,0.12)', border: '1.5px solid rgba(230,57,80,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' },
  pinTitle: { fontSize: 22, fontWeight: 600, color: '#fff', marginBottom: 6 },
  pinSubtitle: { fontSize: 13, color: '#666', marginTop: 4 },
  dotsRow: { display: 'flex', gap: 18, marginBottom: 24 },
  dot: { width: 14, height: 14, borderRadius: '50%', border: '2px solid #e63950', background: 'transparent', transition: 'background 0.15s' },
  dotFilled: { background: '#e63950' },
  pinError: { display: 'flex', alignItems: 'center', gap: 6, color: '#e63950', fontSize: 12, marginBottom: 14, background: 'rgba(230,57,80,0.08)', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(230,57,80,0.2)' },
  keypad: { display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 280 },
  keyRow: { display: 'flex', gap: 12, justifyContent: 'center' },
  keyBtn: { width: 80, height: 80, borderRadius: '50%', border: '1.5px solid rgba(230,57,80,0.5)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  keyNum: { fontSize: 26, fontWeight: 300, color: '#e63950', lineHeight: 1 },
  keyDel: { width: 80, height: 80, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  keyEmpty: { width: 80, height: 80 },
  optionsBtn: { marginTop: 24, background: 'transparent', border: 'none', color: '#888', fontSize: 14, cursor: 'pointer', textDecoration: 'underline' },
  modalBackdrop: { position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  optionsModal: { background: '#1a1a1a', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10 },
  optionsTitle: { textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 8 },
  optionBtn: { width: '100%', padding: '16px', borderRadius: 14, background: '#2a2a2a', border: '1px solid #333', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  optionCancelBtn: { width: '100%', padding: '14px', borderRadius: 14, background: 'transparent', border: 'none', color: '#888', fontSize: 15, cursor: 'pointer', marginTop: 4 },
  pinModalWrap: { background: '#0a0a0a', borderRadius: '20px 20px 0 0', padding: '0 0 20px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  cancelLink: { background: 'transparent', border: 'none', color: '#888', fontSize: 14, cursor: 'pointer', textDecoration: 'underline', marginTop: 8 },
  forgotModal: { background: '#1a1a1a', borderRadius: '20px 20px 0 0', padding: '32px 24px 40px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  forgotIcon: { fontSize: 36, marginBottom: 10 },
  forgotTitle: { color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 10 },
  forgotBody: { color: '#aaa', fontSize: 14, lineHeight: 1.6, textAlign: 'center', marginBottom: 16 },
  forgotInput: { width: '100%', background: '#111', border: '1px solid #333', borderRadius: 12, padding: '14px 16px', color: '#fff', fontSize: 16, outline: 'none', boxSizing: 'border-box' },
  showPwBtn: { background: 'transparent', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', marginTop: 6, alignSelf: 'flex-end' },
  forgotError: { display: 'flex', alignItems: 'center', gap: 6, color: '#e63950', fontSize: 12, marginTop: 8 },
  vaultWrap: { background: '#0d1117', minHeight: '100%', padding: '0 0 40px', fontFamily: "'SF Pro Display', -apple-system, sans-serif", color: '#fff' },
  vaultHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #1e2d3d', background: '#0d1117', position: 'sticky', top: 0, zIndex: 10 },
  vaultHeaderLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  vaultTitle: { fontSize: 17, fontWeight: 700, color: '#fff' },
  vaultUnlockTime: { fontSize: 11, color: '#4ade80', marginTop: 2 },
  lockBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', color: '#facc15', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
  settingsBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid #2a2a2a', color: '#888', cursor: 'pointer' },
  addNoteBox: { margin: '16px', background: '#161b22', border: '1px solid #1e2d3d', borderRadius: 16, padding: 16 },
  addNoteLabel: { display: 'flex', alignItems: 'center', gap: 6, color: '#22d3ee', fontSize: 13, fontWeight: 600, marginBottom: 10 },
  textarea: { width: '100%', height: 90, background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 10, padding: 12, color: '#fff', fontSize: 14, resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  saveBtn: { width: '100%', marginTop: 10, padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #22d3ee, #4ade80)', color: '#0a0a0a', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  errorMsg: { display: 'flex', alignItems: 'center', gap: 6, margin: '0 16px 12px', padding: '10px 12px', background: 'rgba(230,57,80,0.1)', border: '1px solid rgba(230,57,80,0.3)', borderRadius: 10, color: '#f87171', fontSize: 13 },
  successMsg: { margin: '0 16px 12px', padding: '10px 12px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 10, color: '#4ade80', fontSize: 13 },
  notesLabel: { padding: '0 16px 8px', fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em' },
  loadingSmall: { padding: '0 16px', color: '#555', fontSize: 13, fontStyle: 'italic' },
  notesList: { display: 'flex', flexDirection: 'column', gap: 10, padding: '0 16px' },
  noteCard: { background: '#161b22', border: '1px solid #1e2d3d', borderRadius: 14, padding: '14px' },
  noteCardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  noteDate: { color: '#555', fontSize: 11 },
  noteBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)', color: '#22d3ee', fontSize: 11, cursor: 'pointer' },
  noteBtnRed: { background: 'rgba(230,57,80,0.08)', border: '1px solid rgba(230,57,80,0.25)', color: '#e63950' },
  noteContent: { background: '#0d1117', borderRadius: 8, padding: '10px 12px', fontSize: 14, lineHeight: 1.5, maxHeight: 120, overflowY: 'auto', border: '1px solid #1e2d3d' },
  noteEncrypted: { display: 'flex', alignItems: 'center', gap: 6, color: '#555', fontStyle: 'italic', fontSize: 13 },
  loadingWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 200, color: '#888' },
  loadingText: { color: '#666', fontSize: 14 },
};