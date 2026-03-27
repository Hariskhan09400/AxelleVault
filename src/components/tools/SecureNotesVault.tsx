import { useEffect, useState } from 'react';
import {
  Shield,
  Lock,
  Unlock,
  Trash2,
  Plus,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  fetchEncryptedNotes,
  saveEncryptedNote,
  deleteEncryptedNote,
  fetchPinHash,
  savePinHash,
  deletePinHash,
  deleteAllUserNotes,
  EncryptedNote,
} from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

// ─── Crypto Utilities ────────────────────────────────────────────────────────

const generateSalt = (): string => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...salt));
};

const deriveKeyFromPin = async (pin: string, salt: string): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const saltBuffer = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));

  const baseKey = await window.crypto.subtle.importKey('raw', data, 'PBKDF2', false, [
    'deriveBits',
  ]);

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );

  return await window.crypto.subtle.importKey('raw', derivedBits, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
};

const hashPin = async (pin: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

const generateIv = (): Uint8Array => window.crypto.getRandomValues(new Uint8Array(12));

const toBase64 = (buffer: ArrayBuffer | Uint8Array): string =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)));

const fromBase64 = (str: string): Uint8Array =>
  Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

const encryptText = async (
  text: string,
  pin: string,
  salt: string
): Promise<{ content: string; iv: string }> => {
  const encoder = new TextEncoder();
  const key = await deriveKeyFromPin(pin, salt);
  const iv = generateIv();

  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(text)
  );

  return {
    content: toBase64(encrypted),
    iv: toBase64(iv),
  };
};

const decryptText = async (
  content: string,
  iv: string,
  pin: string,
  salt: string
): Promise<string | null> => {
  try {
    const key = await deriveKeyFromPin(pin, salt);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(iv) },
      key,
      fromBase64(content)
    );
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('[Decrypt] Error:', err);
    return null;
  }
};


// ─── Main Component ─────────────────────────────────────────────────────

export const SecureNotesVault = () => {
  const { user } = useAuth();

  // PIN state
  const [pinExists, setPinExists] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinError, setPinError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lastUnlockTime, setLastUnlockTime] = useState<Date | null>(null);
  const [vaultLoading, setVaultLoading] = useState(true);

  // Notes state
  const [notes, setNotes] = useState<EncryptedNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [decryptedNotes, setDecryptedNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // UI state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [confirmForgotPin, setConfirmForgotPin] = useState(false);

  // Inactivity auto-lock (5 minutes)
  const INACTIVITY_TIMEOUT = 5 * 60 * 1000;
  const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(null);

  // Check if PIN exists on mount
  useEffect(() => {
    const checkPinStatus = async () => {
      setVaultLoading(true);
      try {
        if (!user) {
          setPinExists(false);
          return;
        }

        const { data, error } = await fetchPinHash(user.id);

        if (error) {
          console.error('[Vault] fetchPinHash error:', error.message);
          setPinError('Unable to read vault status.');
          setPinExists(false);
        } else {
          setPinExists(!!data?.pin_hash);
        }
      } catch (err) {
        console.error('[Vault] checkPinStatus exception', err);
        setPinError('Unable to read vault status.');
        setPinExists(false);
      } finally {
        setVaultLoading(false);
      }
    };

    checkPinStatus();
  }, [user]);

  // Auto-lock on inactivity
  useEffect(() => {
    if (!isUnlocked) return;

    const resetTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      const timer = setTimeout(() => {
        setIsUnlocked(false);
        setPinError('Session locked due to inactivity.');
      }, INACTIVITY_TIMEOUT);
      setInactivityTimer(timer);
    };

    const handleActivity = () => resetTimer();

    window.addEventListener('click', handleActivity);
    window.addEventListener('keypress', handleActivity);
    resetTimer();

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      if (inactivityTimer) clearTimeout(inactivityTimer);
    };
  }, [isUnlocked, inactivityTimer]);

  // Load notes when unlocked
  useEffect(() => {
    if (!isUnlocked || !user) return;

    const loadNotes = async () => {
      setLoading(true);
      const { data, error } = await fetchEncryptedNotes(user.id);
      if (error) {
        setError('Unable to load notes: ' + error.message);
        setNotes([]);
      } else {
        setNotes(data || []);
        setDecryptedNotes({});
      }
      setLoading(false);
    };

    loadNotes();
  }, [isUnlocked, user]);

  // ─── PIN CREATION ────────────────────────────────────────────────

  const handleCreatePin = async () => {
    setPinError('');

    if (!pin || pin.length < 4 || pin.length > 6) {
      setPinError('PIN must be 4-6 digits.');
      return;
    }

    if (!/^\d+$/.test(pin)) {
      setPinError('PIN must contain only numbers.');
      return;
    }

    if (pin !== pinConfirm) {
      setPinError('PIN confirmation does not match.');
      return;
    }

    if (!user) return;
    if (loading) return; // Prevent double-submission

    try {
      setLoading(true);
      const pinHash = await hashPin(pin);
      const { error } = await savePinHash(user.id, pinHash, 3); // 3 retries with backoff

      if (error) {
        const errorMsg = error.message ? String(error.message) : String(error);
        if (errorMsg.includes('Lock')) {
          setPinError('Database busy. Please try again in a moment.');
        } else {
          setPinError('Failed to save PIN: ' + errorMsg);
        }
        return;
      }

      setPinExists(true);
      setPin('');
      setPinConfirm('');
      setIsUnlocked(true);
      setLastUnlockTime(new Date());
      setPinError('');
    } catch (err) {
      setPinError('Error creating PIN: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  // ─── PIN UNLOCK ──────────────────────────────────────────────────

  const handleUnlockVault = async () => {
    setPinError('');

    if (isLocked) {
      setPinError('Too many failed attempts. Try again in 5 minutes.');
      return;
    }

    if (!user || !pin) {
      setPinError('Enter your PIN.');
      return;
    }

    try {
      setLoading(true);
      const { data } = await fetchPinHash(user.id);
      if (!data?.pin_hash) {
        setPinError('PIN not found.');
        return;
      }

      const enteredHash = await hashPin(pin);

      if (enteredHash !== data.pin_hash) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        if (newAttempts >= 5) {
          setIsLocked(true);
          setTimeout(() => {
            setIsLocked(false);
            setFailedAttempts(0);
          }, 5 * 60 * 1000);
          setPinError('Too many failed attempts. Vault locked for 5 minutes.');
        } else {
          setPinError(`Wrong PIN. ${5 - newAttempts} attempts left.`);
        }
        return;
      }

      setFailedAttempts(0);
      setIsUnlocked(true);
      setLastUnlockTime(new Date());
      setPin('');
      setPinError('');
    } catch (err) {
      setPinError('Error unlocking vault: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  // ─── SAVE NOTE ───────────────────────────────────────────────────

  const handleSaveNote = async () => {
    if (!user || !isUnlocked) return;

    if (!newNote.trim()) {
      setError('Please type a note.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Get vault salt from first note, or generate new
      let vaultSalt = notes.length > 0 ? notes[0].salt : generateSalt();

      const encrypted = await encryptText(newNote.trim(), pin, vaultSalt);
      const { error } = await saveEncryptedNote(
        user.id,
        encrypted.content,
        encrypted.iv,
        vaultSalt
      );

      if (error) {
        setError('Failed to save note: ' + error.message);
        return;
      }

      setNewNote('');
      const { data } = await fetchEncryptedNotes(user.id);
      setNotes(data || []);
    } catch (err) {
      setError('Error saving note: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  // ─── DECRYPT NOTE ────────────────────────────────────────────────

  const handleDecryptNote = async (note: EncryptedNote) => {
    try {
      const decrypted = await decryptText(note.encrypted_content, note.iv, pin, note.salt);
      if (decrypted === null) {
        setError('Unable to decrypt note.');
        return;
      }
      setDecryptedNotes((prev) => ({ ...prev, [note.id]: decrypted }));
      setError('');
    } catch (err) {
      setError('Error decrypting note: ' + String(err));
    }
  };

  // ─── DELETE NOTE ─────────────────────────────────────────────────

  const handleDeleteNote = async (noteId: string) => {
    if (!user) return;

    try {
      setLoading(true);
      const { error } = await deleteEncryptedNote(noteId);
      if (error) {
        setError('Failed to delete note: ' + error.message);
        return;
      }

      setDeleteConfirm(null);
      const { data } = await fetchEncryptedNotes(user.id);
      setNotes(data || []);
      setDecryptedNotes((prev) => {
        const updated = { ...prev };
        delete updated[noteId];
        return updated;
      });
    } catch (err) {
      setError('Error deleting note: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  // ─── FORGOT PIN ──────────────────────────────────────────────────

  const handleForgotPin = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Delete all notes
      const { error: deleteNotesErr } = await deleteAllUserNotes(user.id);
      if (deleteNotesErr) throw deleteNotesErr;

      // Delete PIN
      const { error: deletePinErr } = await deletePinHash(user.id);
      if (deletePinErr) throw deletePinErr;

      // Reset state
      setNotes([]);
      setDecryptedNotes({});
      setIsUnlocked(false);
      setPinExists(false);
      setPin('');
      setPinConfirm('');
      setConfirmForgotPin(false);
      setShowForgotPin(false);
      setPinError('Vault reset. Create a new PIN to continue.');
    } catch (err) {
      setPinError('Error resetting vault: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  // ─── LOCK VAULT ──────────────────────────────────────────────────

  const handleLockVault = () => {
    setIsUnlocked(false);
    setPin('');
    setDecryptedNotes({});
    setPinError('');
    setFailedAttempts(0);
  };

  // ─── RENDER UI ───────────────────────────────────────────────────

  if (vaultLoading) {
    return (
      <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-cyan-400" />
          <h3 className="text-xl font-semibold text-white">Secure Notes Vault</h3>
        </div>
        <p className="text-gray-400">Loading vault...</p>
      </div>
    );
  }

  // No PIN - Create PIN
  if (!pinExists) {
    return (
      <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <Lock className="w-6 h-6 text-rose-400" />
          <h3 className="text-2xl font-bold text-white">Create Vault PIN</h3>
        </div>

        <p className="text-gray-300 mb-6">
          Secure your notes with a 4–6 digit PIN. This PIN will be used to unlock and encrypt all your notes.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">PIN (4-6 digits)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full bg-gray-800/60 border border-cyan-500/30 rounded-lg px-3 py-2 text-white text-xl tracking-widest focus:border-cyan-400 focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Confirm PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full bg-gray-800/60 border border-cyan-500/30 rounded-lg px-3 py-2 text-white text-xl tracking-widest focus:border-cyan-400 focus:outline-none transition"
            />
          </div>

          {pinError && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded p-2">{pinError}</div>}

          <button
            onClick={handleCreatePin}
            disabled={!pin || !pinConfirm || loading}
            className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition hover:opacity-90"
          >
            {loading ? 'Creating...' : 'Create PIN'}
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          ⚠️ Do NOT forget your PIN. It cannot be recovered without resetting the entire vault.
        </p>
      </div>
    );
  }

  // PIN exists but not unlocked - Unlock screen
  if (!isUnlocked) {
    return (
      <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <Lock className="w-6 h-6 text-yellow-400" />
          <h3 className="text-2xl font-bold text-white">Unlock Vault</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Enter PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              disabled={isLocked}
              className="w-full bg-gray-800/60 border border-cyan-500/30 rounded-lg px-3 py-2 text-white text-xl tracking-widest focus:border-cyan-400 focus:outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {pinError && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded p-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {pinError}
            </div>
          )}

          <button
            onClick={handleUnlockVault}
            disabled={!pin || isLocked || loading}
            className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition hover:opacity-90"
          >
            {loading ? 'Unlocking...' : 'Unlock Vault'}
          </button>

          <button
            onClick={() => {
              setShowForgotPin(true);
              setPinError('');
            }}
            className="w-full text-sm text-gray-400 hover:text-gray-300 transition"
          >
            Forgot PIN?
          </button>
        </div>

        {/* Forgot PIN Modal */}
        {showForgotPin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-gray-900 border border-red-500/40 rounded-lg p-6 w-full max-w-sm shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <h4 className="text-lg font-semibold text-white">Reset Vault?</h4>
              </div>

              {!confirmForgotPin ? (
                <>
                  <p className="text-sm text-gray-300 mb-4">
                    ⚠️ <strong>WARNING:</strong> Resetting your PIN will:
                  </p>
                  <ul className="text-sm text-red-300 space-y-1 mb-4 list-disc list-inside">
                    <li>Delete ALL encrypted notes permanently</li>
                    <li>Remove your current PIN</li>
                    <li>Notes CANNOT be recovered</li>
                  </ul>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowForgotPin(false)}
                      className="flex-1 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setConfirmForgotPin(true)}
                      className="flex-1 px-3 py-2 rounded bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition text-sm font-semibold"
                    >
                      Continue
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-300 mb-4">
                    Type <strong>"DELETE"</strong> to confirm:
                  </p>
                  <input
                    type="text"
                    placeholder="Type DELETE"
                    onChange={(e) => setShowForgotPin(e.target.value === 'DELETE')}
                    className="w-full bg-gray-800/60 border border-red-500/30 rounded-lg px-3 py-2 text-white mb-4 focus:border-red-400 focus:outline-none transition"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setConfirmForgotPin(false);
                        setShowForgotPin(false);
                      }}
                      className="flex-1 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleForgotPin}
                      disabled={loading}
                      className="flex-1 px-3 py-2 rounded bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Resetting...' : 'Reset Vault'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Unlocked - Show vault interface
  return (
    <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Unlock className="w-6 h-6 text-green-400" />
          <div>
            <h3 className="text-2xl font-bold text-white">Secure Notes Vault</h3>
            <p className="text-xs text-gray-400">
              🔓 Unlocked
              {lastUnlockTime && ` • Last unlocked: ${lastUnlockTime.toLocaleTimeString()}`}
            </p>
          </div>
        </div>
        <button
          onClick={handleLockVault}
          className="px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/30 transition text-sm flex items-center gap-2"
        >
          <Lock className="w-4 h-4" /> Lock
        </button>
      </div>

      {/* Add Note */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-cyan-400" />
          <h4 className="text-sm font-semibold text-white">Add New Note</h4>
        </div>

        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Type your secure note here..."
          className="w-full h-24 bg-gray-800/60 border border-cyan-500/30 rounded-lg p-3 text-white focus:border-cyan-400 focus:outline-none transition resize-none"
        />

        <button
          onClick={handleSaveNote}
          disabled={!newNote.trim() || loading}
          className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition hover:opacity-90"
        >
          {loading ? 'Saving...' : 'Save Note'}
        </button>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded p-2 mb-4">
          {error}
        </div>
      )}

      {/* Notes List */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-300 mb-3">
          {notes.length === 0 ? 'No notes yet' : `${notes.length} Note${notes.length !== 1 ? 's' : ''}`}
        </h4>

        {notes.map((note) => (
          <div key={note.id} className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="text-xs text-gray-400">{new Date(note.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                {!decryptedNotes[note.id] && (
                  <button
                    onClick={() => handleDecryptNote(note)}
                    className="text-cyan-300 hover:text-cyan-100 text-xs flex items-center gap-1 transition"
                  >
                    <Eye className="w-3 h-3" /> View
                  </button>
                )}
                {decryptedNotes[note.id] && (
                  <button
                    onClick={() =>
                      setDecryptedNotes((prev) => {
                        const updated = { ...prev };
                        delete updated[note.id];
                        return updated;
                      })
                    }
                    className="text-cyan-300 hover:text-cyan-100 text-xs flex items-center gap-1 transition"
                  >
                    <EyeOff className="w-3 h-3" /> Hide
                  </button>
                )}
                <button
                  onClick={() => setDeleteConfirm(note.id)}
                  className="text-red-400 hover:text-red-200 text-xs flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>

            <div className="text-gray-300 text-sm break-words p-3 bg-gray-900/50 rounded border border-gray-700/50 max-h-32 overflow-y-auto">
              {decryptedNotes[note.id] ? (
                decryptedNotes[note.id]
              ) : (
                <span className="text-gray-500 italic">🔒 Click "View" to decrypt</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-500/40 rounded-lg p-6 w-full max-w-sm shadow-lg">
            <h4 className="text-lg font-semibold text-white mb-2">Delete Note?</h4>
            <p className="text-sm text-gray-400 mb-4">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteNote(deleteConfirm)}
                disabled={loading}
                className="flex-1 px-3 py-2 rounded bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};