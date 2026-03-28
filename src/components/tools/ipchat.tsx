/**
 * ipchat.tsx — UPGRADED v2.2
 * ─────────────────────────────────────────────────────
 * Real-time IP-based chat using Supabase Realtime
 * • NO backend server needed
 * • NO data stored in database — uses Broadcast (ephemeral)
 * • Unlimited users, same "room code" = same channel
 * • Mobile-friendly responsive layout (hamburger sidebar)
 * • Image upload via base64 broadcast (ephemeral, no storage)
 * • Full screen fix (100vh, position fixed)
 * • Big readable bubbles — purple self, dark other
 * ─────────────────────────────────────────────────────
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  KeyboardEvent,
  ChangeEvent,
} from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

// ── Types ───────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  type: 'message' | 'system';
  username?: string;
  text: string;
  image?: string;
  timestamp: number;
  isSelf?: boolean;
  systemKind?: 'join' | 'leave' | 'clear' | 'info';
}

interface RoomUser {
  username: string;
  joinedAt: number;
  presenceKey: string;
}

type Screen = 'join' | 'chat';

// ── Helpers ─────────────────────────────────────────────────
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function sanitize(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
    .slice(0, 500);
}

function compressImage(file: File, maxSize = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ════════════════════════════════════════════════════════════
//  COMPONENT
// ════════════════════════════════════════════════════════════
export default function IPChat() {
  const [screen, setScreen]           = useState<Screen>('join');
  const [username, setUsername]       = useState('');
  const [roomId, setRoomId]           = useState('');
  const [joinError, setJoinError]     = useState('');
  const [connecting, setConnecting]   = useState(false);

  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [members, setMembers]           = useState<RoomUser[]>([]);
  const [msgInput, setMsgInput]         = useState('');
  const [typingUsers, setTypingUsers]   = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [lightbox, setLightbox]         = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadError, setUploadError]   = useState('');

  const myUsername  = useRef('');
  const myRoom      = useRef('');
  const presenceKey = useRef(uid());
  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping    = useRef(false);
  const fileRef     = useRef<HTMLInputElement>(null);

  const scrollBottom = useCallback(() => {
    setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), 40);
  }, []);

  const addMsg = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const cleanup = useCallback(async () => {
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // ── JOIN ──────────────────────────────────────────────────
  const handleJoin = useCallback(async () => {
    const uName = sanitize(username).slice(0, 24);
    const rId   = sanitize(roomId).slice(0, 64);

    if (!uName) { setJoinError('⚠ Enter a username'); return; }
    if (!rId)   { setJoinError('⚠ Enter an IP / room code'); return; }

    setJoinError('');
    setConnecting(true);

    myUsername.current = uName;
    myRoom.current = rId;

    const channelName = `ipchat_${rId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: presenceKey.current } },
    });

    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ username: string; joinedAt: number }>();
      const users: RoomUser[] = Object.entries(state).map(([key, presences]) => ({
        presenceKey: key,
        username: (presences as any)[0]?.username ?? 'unknown',
        joinedAt: (presences as any)[0]?.joinedAt ?? Date.now(),
      }));
      setMembers(users);
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
      const uName = newPresences[0]?.username;
      if (uName && uName !== myUsername.current) {
        addMsg({ id: uid(), type: 'system', text: `${uName} joined the room`, timestamp: Date.now(), systemKind: 'join' });
        scrollBottom();
      }
    });

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
      const uName = leftPresences[0]?.username;
      if (uName) {
        addMsg({ id: uid(), type: 'system', text: `${uName} left the room`, timestamp: Date.now(), systemKind: 'leave' });
        setTypingUsers(prev => { const n = new Set(prev); n.delete(uName); return n; });
        scrollBottom();
      }
    });

    channel.on('broadcast', { event: 'message' }, ({ payload }: any) => {
      addMsg({
        id: uid(),
        type: 'message',
        username: payload.username,
        text: payload.text,
        image: payload.image,
        timestamp: payload.timestamp,
        isSelf: payload.username === myUsername.current,
      });
      scrollBottom();
    });

    channel.on('broadcast', { event: 'typing' }, ({ payload }: any) => {
      if (payload.username === myUsername.current) return;
      setTypingUsers(prev => {
        const n = new Set(prev);
        payload.isTyping ? n.add(payload.username) : n.delete(payload.username);
        return n;
      });
    });

    channel.on('broadcast', { event: 'clear' }, ({ payload }: any) => {
      setMessages([{
        id: uid(), type: 'system',
        text: `${payload.username} cleared the chat`,
        timestamp: Date.now(), systemKind: 'clear',
      }]);
      scrollBottom();
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ username: uName, joinedAt: Date.now() });
        setScreen('chat');
        setConnecting(false);
        addMsg({ id: uid(), type: 'system', text: '— Start of conversation —', timestamp: Date.now(), systemKind: 'info' });
        scrollBottom();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setJoinError('⚠ Failed to connect. Try again.');
        setConnecting(false);
        cleanup();
      }
    });
  }, [username, roomId, addMsg, scrollBottom, cleanup]);

  // ── SEND ─────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const msg = sanitize(msgInput);
    if ((!msg && !imagePreview) || !channelRef.current) return;

    await channelRef.current.send({
      type: 'broadcast',
      event: 'message',
      payload: {
        username: myUsername.current,
        text: msg,
        image: imagePreview ?? undefined,
        timestamp: Date.now(),
      },
    });

    setMsgInput('');
    setImagePreview(null);
    stopTyping();
  }, [msgInput, imagePreview]);

  // ── IMAGE PICK ────────────────────────────────────────────
  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setUploadError('Only image files allowed'); return; }
    if (file.size > 10 * 1024 * 1024)   { setUploadError('Image too large (max 10MB)'); return; }
    setUploadError('');
    try {
      const compressed = await compressImage(file);
      setImagePreview(compressed);
    } catch {
      setUploadError('Failed to process image');
    }
    e.target.value = '';
  }, []);

  // ── TYPING ────────────────────────────────────────────────
  const stopTyping = useCallback(() => {
    if (isTyping.current) {
      isTyping.current = false;
      channelRef.current?.send({
        type: 'broadcast', event: 'typing',
        payload: { username: myUsername.current, isTyping: false },
      });
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, []);

  const handleMsgInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setMsgInput(e.target.value);
    if (!isTyping.current) {
      isTyping.current = true;
      channelRef.current?.send({
        type: 'broadcast', event: 'typing',
        payload: { username: myUsername.current, isTyping: true },
      });
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 2000);
  }, [stopTyping]);

  // ── CLEAR ─────────────────────────────────────────────────
  const handleClear = useCallback(async () => {
    if (!channelRef.current) return;
    if (!window.confirm('Clear chat for everyone in this room?')) return;
    await channelRef.current.send({
      type: 'broadcast', event: 'clear',
      payload: { username: myUsername.current },
    });
  }, []);

  // ── LEAVE ─────────────────────────────────────────────────
  const handleLeave = useCallback(async () => {
    stopTyping();
    await cleanup();
    setScreen('join');
    setMessages([]);
    setMembers([]);
    setMsgInput('');
    setTypingUsers(new Set());
    setImagePreview(null);
    setSidebarOpen(false);
    myUsername.current = '';
    myRoom.current = '';
  }, [cleanup, stopTyping]);

  useEffect(() => () => { cleanup(); }, [cleanup]);

  const onJoinKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleJoin(); };
  const onMsgKey  = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleSend(); };

  const typingArr = Array.from(typingUsers);
  const typingLabel = typingArr.length === 1
    ? `${typingArr[0]} is typing`
    : typingArr.length > 1
    ? `${typingArr.join(', ')} are typing`
    : '';

  const onlineCount = members.length;

  // ════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div className="ipc-lightbox" onClick={() => setLightbox(null)}>
          <button className="ipc-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          <img src={lightbox} alt="Full size" className="ipc-lightbox-img" />
        </div>
      )}

      {/* ── JOIN SCREEN ── */}
      {screen === 'join' && (
        <div className="ipc-wrap">
          <div className="ipc-grid-bg" />
          <div className="ipc-join-card">
            <div className="ipc-logo">
              <span className="ipc-br">[</span>
              <span className="ipc-lip">IP</span>
              <span className="ipc-lch">CHAT</span>
              <span className="ipc-br">]</span>
            </div>
            <p className="ipc-sub">Enter a shared IP address to join the same room</p>

            <div className="ipc-field">
              <label className="ipc-lbl">USERNAME</label>
              <div className="ipc-iw">
                <span className="ipc-ii">›</span>
                <input className="ipc-in" type="text" placeholder="e.g. alice"
                  value={username} maxLength={24} autoComplete="off" spellCheck={false}
                  onChange={e => setUsername(e.target.value)} onKeyDown={onJoinKey} />
              </div>
            </div>

            <div className="ipc-field">
              <label className="ipc-lbl">ROOM CODE <span className="ipc-lbl-s">(IP ADDRESS)</span></label>
              <div className="ipc-iw">
                <span className="ipc-ii">⬡</span>
                <input className="ipc-in" type="text" placeholder="e.g. 192.168.1.1"
                  value={roomId} maxLength={64} autoComplete="off" spellCheck={false}
                  onChange={e => setRoomId(e.target.value)} onKeyDown={onJoinKey} />
              </div>
              <p className="ipc-hint">Anyone who enters the same IP will share this room</p>
            </div>

            <button className="ipc-conn-btn" onClick={handleJoin} disabled={connecting}>
              <span>{connecting ? 'CONNECTING...' : 'CONNECT'}</span>
              <span className="ipc-arr">→</span>
              <div className="ipc-btn-glow" />
            </button>

            {joinError && <div className="ipc-err">{joinError}</div>}

            <div className="ipc-footer">
              <span className="ipc-dot" /> No data stored
              <span className="ipc-sep">·</span>
              <span className="ipc-dot" /> Ephemeral sessions
              <span className="ipc-sep">·</span>
              <span className="ipc-dot" /> Unlimited users
            </div>
          </div>
        </div>
      )}

      {/* ── CHAT SCREEN ── */}
      {screen === 'chat' && (
        <div className="ipc-chat-root">
          <div className="ipc-grid-bg" />

          {sidebarOpen && (
            <div className="ipc-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
          )}

          {/* SIDEBAR */}
          <aside className={`ipc-sidebar${sidebarOpen ? ' ipc-sidebar-open' : ''}`}>
            <div className="ipc-sidebar-logo">
              <span className="ipc-br">[</span>
              <span className="ipc-lip">IP</span>
              <span className="ipc-lch">CHAT</span>
              <span className="ipc-br">]</span>
            </div>

            <div className="ipc-room-box">
              <div className="ipc-room-lbl">ACTIVE ROOM</div>
              <div className="ipc-room-ip">{myRoom.current}</div>
              <div className="ipc-room-online">
                <span className="ipc-pulse" />
                {onlineCount} online
              </div>
            </div>

            <div className="ipc-members">
              <div className="ipc-mem-lbl">MEMBERS</div>
              <ul className="ipc-mem-list">
                {members.map(u => (
                  <li key={u.presenceKey} className="ipc-mem-item">
                    <span className="ipc-mem-dot" />
                    <span className="ipc-mem-name">{u.username}</span>
                    {u.username === myUsername.current && <span className="ipc-you">you</span>}
                  </li>
                ))}
              </ul>
            </div>

            <div className="ipc-sb-bottom">
              <button className="ipc-leave-btn" onClick={handleLeave}>← Leave Room</button>
              <div className="ipc-ver">v2.2 // IPCHAT</div>
            </div>
          </aside>

          {/* MAIN */}
          <main className="ipc-main">
            <header className="ipc-header">
              <button className="ipc-hamburger" onClick={() => setSidebarOpen(o => !o)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6"  x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
              <div className="ipc-hroom">
                <span className="ipc-hpre">ROOM //</span>
                <span className="ipc-hid">{myRoom.current}</span>
              </div>
              <div className="ipc-hactions">
                <button className="ipc-clear-btn" onClick={handleClear}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/>
                  </svg>
                  <span className="ipc-clear-label">CLEAR</span>
                </button>
                <div className="ipc-badge">
                  <span className="ipc-badge-dot" />
                  {myUsername.current}
                </div>
              </div>
            </header>

            {/* MESSAGES */}
            <div className="ipc-msgs">
              {messages.map(msg =>
                msg.type === 'system' ? (
                  <div key={msg.id} className={`ipc-sys ipc-sys-${msg.systemKind}`}>{msg.text}</div>
                ) : (
                  <div key={msg.id} className={`ipc-mwrap ${msg.isSelf ? 'ipc-self' : 'ipc-other'}`}>
                    <div className="ipc-mmeta">
                      {!msg.isSelf && <span className="ipc-muser">{msg.username}</span>}
                      <span className="ipc-mtime">{fmtTime(msg.timestamp)}</span>
                    </div>
                    {msg.image && (
                      <div className="ipc-img-bubble" onClick={() => setLightbox(msg.image!)}>
                        <img src={msg.image} alt="shared" className="ipc-img-thumb" />
                        <div className="ipc-img-overlay">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                          </svg>
                        </div>
                      </div>
                    )}
                    {msg.text && <div className="ipc-bubble">{msg.text}</div>}
                  </div>
                )
              )}
              <div ref={messagesEnd} />
            </div>

            {/* TYPING INDICATOR */}
            <div className={`ipc-typing ${typingLabel ? 'ipc-typing-on' : ''}`}>
              {typingLabel && (
                <>
                  <span className="ipc-tdots"><span /><span /><span /></span>
                  <span>{typingLabel}</span>
                </>
              )}
            </div>

            {/* IMAGE PREVIEW */}
            {imagePreview && (
              <div className="ipc-img-preview-bar">
                <img src={imagePreview} alt="preview" className="ipc-img-preview-thumb" />
                <span className="ipc-img-preview-label">Image ready to send</span>
                <button className="ipc-img-preview-remove" onClick={() => setImagePreview(null)}>✕</button>
              </div>
            )}
            {uploadError && <div className="ipc-upload-err">{uploadError}</div>}

            {/* INPUT BAR */}
            <div className="ipc-bar">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button className="ipc-attach" onClick={() => fileRef.current?.click()} title="Send image">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21,15 16,10 5,21"/>
                </svg>
              </button>
              <input className="ipc-msg-in" type="text" placeholder="Type a message..."
                value={msgInput} maxLength={500} autoComplete="off" spellCheck={false}
                onChange={handleMsgInput} onKeyDown={onMsgKey} />
              <button className="ipc-send" onClick={handleSend}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22,2 15,22 11,13 2,9"/>
                </svg>
                <div className="ipc-send-glow" />
              </button>
            </div>
          </main>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  STYLES
// ════════════════════════════════════════════════════════════
const CSS = `
  /* ── FULL SCREEN FIX ── */
  html, body { height:100%; margin:0; padding:0; overflow:hidden; }
  #root { height:100%; width:100%; }

  /* ── VARS ── */
  .ipc-wrap, .ipc-chat-root {
    --c:  #00d4ff; --cd:#00a8cc; --cg:rgba(0,212,255,0.08);
    --bg: #070b14; --bg2:#0c1220; --bg3:#111827;
    --bo: #1a2840; --bo2:#1e3050;
    --gr: #00ff88; --re:#ff4466;
    --tx: #c8d8f0; --td:#5a7090; --tm:#324560;
    --mo: 'Share Tech Mono', monospace;
    --sa: 'Rajdhani', sans-serif;
    --sp: 'Space Mono', monospace;
    --ra: 6px;
  }

  /* ── SCREENS ── */
  .ipc-wrap {
    width:100vw; height:100vh; position:fixed; inset:0;
    background:var(--bg); color:var(--tx); font-family:var(--sa);
    display:flex; align-items:center; justify-content:center; overflow:hidden;
  }
  .ipc-chat-root {
    width:100vw; height:100vh; position:fixed; inset:0;
    background:var(--bg); color:var(--tx); font-family:var(--sa);
    display:flex; flex-direction:row; overflow:hidden;
  }

  /* ── GRID BG ── */
  .ipc-grid-bg {
    position:absolute; inset:0; pointer-events:none; z-index:0;
    background-image:
      linear-gradient(rgba(0,212,255,0.03) 1px,transparent 1px),
      linear-gradient(90deg,rgba(0,212,255,0.03) 1px,transparent 1px);
    background-size:40px 40px;
  }

  /* ── JOIN CARD ── */
  .ipc-join-card {
    position:relative; z-index:10;
    width:min(420px, 94vw);
    background:var(--bg2); border:1px solid var(--bo2); border-radius:10px;
    padding:clamp(24px,5vw,42px) clamp(20px,5vw,40px) clamp(20px,4vw,36px);
    box-shadow:0 0 0 1px rgba(0,212,255,0.06),0 0 60px rgba(0,212,255,0.06),0 24px 80px rgba(0,0,0,0.6);
    animation:ipcIn .45s cubic-bezier(.22,1,.36,1) both;
  }
  @keyframes ipcIn { from{opacity:0;transform:translateY(20px) scale(.98)} to{opacity:1;transform:none} }

  .ipc-logo  { text-align:center; font-family:var(--sp); font-size:clamp(20px,5vw,28px); font-weight:700; letter-spacing:6px; margin-bottom:10px; }
  .ipc-br    { color:var(--td); }
  .ipc-lip   { color:var(--tx); }
  .ipc-lch   { color:var(--c); text-shadow:0 0 16px var(--c); }
  .ipc-sub   { text-align:center; color:var(--td); font-family:var(--mo); font-size:11.5px; letter-spacing:.5px; margin-bottom:34px; line-height:1.6; }
  .ipc-field { margin-bottom:20px; }
  .ipc-lbl   { display:block; font-family:var(--mo); font-size:10px; letter-spacing:2px; color:var(--cd); margin-bottom:8px; }
  .ipc-lbl-s { color:var(--tm); font-size:9px; }
  .ipc-iw    { position:relative; display:flex; align-items:center; }
  .ipc-ii    { position:absolute; left:14px; color:var(--cd); font-family:var(--mo); font-size:16px; pointer-events:none; opacity:.7; }
  .ipc-in    { width:100%; background:var(--bg3); border:1px solid var(--bo); border-radius:var(--ra); color:var(--tx); font-family:var(--mo); font-size:13px; padding:13px 16px 13px 36px; outline:none; transition:border-color .2s,box-shadow .2s; letter-spacing:.5px; }
  .ipc-in::placeholder { color:var(--tm); }
  .ipc-in:focus { border-color:var(--cd); box-shadow:0 0 0 3px var(--cg); }
  .ipc-hint  { margin-top:7px; font-family:var(--mo); font-size:10.5px; color:var(--tm); letter-spacing:.3px; }

  .ipc-conn-btn {
    position:relative; width:100%; margin-top:10px; padding:15px 24px;
    background:var(--c); border:none; border-radius:var(--ra);
    color:#060e1a; font-family:var(--sp); font-size:13px; font-weight:700;
    letter-spacing:3px; cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:10px;
    transition:transform .15s,box-shadow .2s,background .2s; overflow:hidden;
  }
  .ipc-conn-btn:hover:not(:disabled) { background:#22e8ff; transform:translateY(-1px); box-shadow:0 0 28px rgba(0,212,255,.45); }
  .ipc-conn-btn:disabled { opacity:.7; cursor:not-allowed; }
  .ipc-arr   { font-size:16px; transition:transform .2s; }
  .ipc-conn-btn:hover .ipc-arr { transform:translateX(4px); }
  .ipc-btn-glow { position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,.15),transparent 60%); pointer-events:none; }
  .ipc-err   { margin-top:12px; font-family:var(--mo); font-size:11px; color:var(--re); text-align:center; letter-spacing:.5px; }
  .ipc-footer { margin-top:28px; text-align:center; font-family:var(--mo); font-size:9.5px; color:var(--tm); letter-spacing:.5px; display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap; }
  .ipc-dot   { width:4px; height:4px; background:var(--gr); border-radius:50%; display:inline-block; box-shadow:0 0 6px var(--gr); }
  .ipc-sep   { opacity:.3; }

  /* ── HAMBURGER ── */
  .ipc-hamburger {
    display:none; background:transparent; border:1px solid var(--bo); border-radius:4px;
    color:var(--td); padding:6px 8px; cursor:pointer;
    align-items:center; justify-content:center; transition:all .2s; flex-shrink:0;
  }
  .ipc-hamburger:hover { border-color:var(--c); color:var(--c); }

  /* ── BACKDROP ── */
  .ipc-sidebar-backdrop {
    display:none; position:fixed; inset:0;
    background:rgba(0,0,0,0.6); z-index:19; backdrop-filter:blur(2px);
  }

  /* ── SIDEBAR ── */
  .ipc-sidebar {
    width:220px; min-width:220px; height:100%;
    background:var(--bg2); border-right:1px solid var(--bo);
    display:flex; flex-direction:column; flex-shrink:0; position:relative; z-index:20;
    transition:transform .3s cubic-bezier(.22,1,.36,1);
  }
  .ipc-sidebar-logo { padding:18px 18px 14px; font-family:var(--sp); font-size:14px; font-weight:700; letter-spacing:4px; border-bottom:1px solid var(--bo); }
  .ipc-room-box  { margin:12px 12px 0; background:rgba(0,212,255,.04); border:1px solid rgba(0,212,255,.12); border-radius:var(--ra); padding:12px 14px; }
  .ipc-room-lbl  { font-family:var(--mo); font-size:9px; letter-spacing:2px; color:var(--tm); margin-bottom:5px; }
  .ipc-room-ip   { font-family:var(--mo); font-size:12px; color:var(--c); letter-spacing:1px; margin-bottom:6px; word-break:break-all; }
  .ipc-room-online { font-family:var(--mo); font-size:11px; color:var(--td); display:flex; align-items:center; gap:6px; }
  .ipc-pulse { width:7px; height:7px; background:var(--gr); border-radius:50%; display:inline-block; box-shadow:0 0 6px var(--gr); animation:ipcPulse 2s ease-in-out infinite; }
  @keyframes ipcPulse { 0%,100%{opacity:1;box-shadow:0 0 6px var(--gr)} 50%{opacity:.6;box-shadow:0 0 12px var(--gr)} }

  .ipc-members   { flex:1; overflow-y:auto; padding:12px 12px 0; scrollbar-width:thin; scrollbar-color:var(--bo) transparent; }
  .ipc-mem-lbl   { font-family:var(--mo); font-size:9px; letter-spacing:2px; color:var(--tm); margin-bottom:8px; }
  .ipc-mem-list  { list-style:none; display:flex; flex-direction:column; gap:3px; }
  .ipc-mem-item  { display:flex; align-items:center; gap:8px; padding:7px 8px; border-radius:4px; font-family:var(--mo); font-size:12px; color:var(--tx); animation:ipcMemIn .3s ease both; }
  @keyframes ipcMemIn { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:none} }
  .ipc-mem-item:hover { background:rgba(255,255,255,.03); }
  .ipc-mem-dot   { width:7px; height:7px; background:var(--gr); border-radius:50%; box-shadow:0 0 5px var(--gr); flex-shrink:0; }
  .ipc-mem-name  { flex:1; }
  .ipc-you       { font-size:9px; letter-spacing:1px; color:var(--c); background:rgba(0,212,255,.1); border:1px solid rgba(0,212,255,.2); padding:1px 5px; border-radius:3px; }

  .ipc-sb-bottom { padding:12px; border-top:1px solid var(--bo); }
  .ipc-leave-btn { width:100%; background:transparent; border:1px solid var(--bo); border-radius:var(--ra); color:var(--td); font-family:var(--mo); font-size:11px; letter-spacing:1px; padding:9px 12px; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all .2s; margin-bottom:8px; }
  .ipc-leave-btn:hover { border-color:var(--re); color:var(--re); background:rgba(255,68,102,.06); }
  .ipc-ver       { font-family:var(--mo); font-size:9px; color:var(--tm); text-align:center; letter-spacing:1px; }

  /* ── MAIN ── */
  .ipc-main { flex:1; display:flex; flex-direction:column; height:100%; overflow:hidden; position:relative; z-index:5; min-width:0; }

  .ipc-header { height:56px; background:var(--bg2); border-bottom:1px solid var(--bo); display:flex; align-items:center; justify-content:space-between; padding:0 16px; flex-shrink:0; gap:10px; }
  .ipc-hroom  { font-family:var(--mo); font-size:13px; display:flex; align-items:center; gap:8px; flex:1; min-width:0; overflow:hidden; }
  .ipc-hpre   { color:var(--tm); letter-spacing:1px; flex-shrink:0; }
  .ipc-hid    { color:var(--c); letter-spacing:1px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ipc-hactions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
  .ipc-clear-btn { background:transparent; border:1px solid var(--bo); border-radius:4px; color:var(--td); font-family:var(--mo); font-size:10px; letter-spacing:1.5px; padding:5px 10px; cursor:pointer; display:flex; align-items:center; gap:5px; transition:all .2s; }
  .ipc-clear-btn:hover { border-color:rgba(255,68,102,.4); color:var(--re); background:rgba(255,68,102,.06); }
  .ipc-clear-label { display:inline; }
  .ipc-badge  { display:flex; align-items:center; gap:6px; font-family:var(--mo); font-size:12px; color:var(--tx); background:var(--bg3); border:1px solid var(--bo); border-radius:4px; padding:5px 12px; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ipc-badge-dot { width:6px; height:6px; background:var(--gr); border-radius:50%; box-shadow:0 0 6px var(--gr); flex-shrink:0; }

  /* ── MESSAGES ── */
  .ipc-msgs { flex:1; overflow-y:auto; padding:20px 20px; display:flex; flex-direction:column; gap:2px; scrollbar-width:thin; scrollbar-color:var(--bo) transparent; }
  .ipc-msgs::-webkit-scrollbar { width:4px; }
  .ipc-msgs::-webkit-scrollbar-thumb { background:var(--bo); border-radius:2px; }

  .ipc-sys { align-self:center; font-family:var(--mo); font-size:10px; color:var(--tm); letter-spacing:.5px; padding:5px 14px; background:rgba(255,255,255,.02); border:1px solid var(--bo); border-radius:20px; text-align:center; animation:ipcMsgIn .25s ease both; margin:8px 0; }
  .ipc-sys-join  { color:rgba(0,255,136,.7);  border-color:rgba(0,255,136,.15); }
  .ipc-sys-leave { color:rgba(255,68,102,.7); border-color:rgba(255,68,102,.12); }
  .ipc-sys-clear { color:rgba(0,212,255,.6);  border-color:rgba(0,212,255,.12); }

  .ipc-mwrap { display:flex; flex-direction:column; max-width:68%; animation:ipcMsgIn .25s cubic-bezier(.22,1,.36,1) both; margin-bottom:10px; }
  @keyframes ipcMsgIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  .ipc-self  { align-self:flex-end;   align-items:flex-end; }
  .ipc-other { align-self:flex-start; align-items:flex-start; }

  .ipc-mmeta { display:flex; align-items:center; gap:8px; margin-bottom:5px; }
  .ipc-muser { font-family:var(--mo); font-size:11px; color:var(--cd); letter-spacing:.5px; }
  .ipc-mtime { font-family:var(--mo); font-size:10px; color:var(--tm); }

  /* ── BUBBLES — big & readable ── */
  .ipc-bubble {
    padding:12px 18px;
    border-radius:20px;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:16px; font-weight:400; line-height:1.55;
    max-width:100%; word-break:break-word;
  }
  /* YOUR messages — solid purple */
  .ipc-self .ipc-bubble {
    background:#7c5cfc;
    color:#fff;
    border:none;
    border-bottom-right-radius:4px;
    box-shadow:0 3px 16px rgba(124,92,252,0.4);
  }
  /* OTHER person's messages — dark card */
  .ipc-other .ipc-bubble {
    background:#1a2235;
    border:1px solid #243050;
    color:#ddeeff;
    border-bottom-left-radius:4px;
  }

  /* ── IMAGE BUBBLE ── */
  .ipc-img-bubble { position:relative; cursor:pointer; border-radius:12px; overflow:hidden; max-width:260px; border:1px solid var(--bo); margin-bottom:4px; }
  .ipc-self .ipc-img-bubble { border-color:rgba(124,92,252,.4); }
  .ipc-img-thumb  { display:block; width:100%; height:auto; max-height:260px; object-fit:cover; }
  .ipc-img-overlay { position:absolute; inset:0; background:rgba(0,0,0,.4); opacity:0; display:flex; align-items:center; justify-content:center; color:#fff; transition:opacity .2s; }
  .ipc-img-bubble:hover .ipc-img-overlay { opacity:1; }

  /* ── LIGHTBOX ── */
  .ipc-lightbox { position:fixed; inset:0; z-index:999; background:rgba(0,0,0,.92); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; cursor:zoom-out; animation:ipcIn .2s ease both; }
  .ipc-lightbox-img { max-width:94vw; max-height:90vh; border-radius:8px; box-shadow:0 0 60px rgba(0,212,255,.2); object-fit:contain; }
  .ipc-lightbox-close { position:absolute; top:16px; right:20px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.2); border-radius:50%; width:36px; height:36px; color:#fff; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .2s; }
  .ipc-lightbox-close:hover { background:rgba(255,68,102,.3); }

  /* ── IMAGE PREVIEW BAR ── */
  .ipc-img-preview-bar { display:flex; align-items:center; gap:10px; padding:8px 16px; background:rgba(124,92,252,.08); border-top:1px solid rgba(124,92,252,.2); flex-shrink:0; }
  .ipc-img-preview-thumb { width:42px; height:42px; object-fit:cover; border-radius:6px; border:1px solid rgba(124,92,252,.3); }
  .ipc-img-preview-label { font-family:var(--mo); font-size:10px; color:var(--cd); letter-spacing:.5px; flex:1; }
  .ipc-img-preview-remove { background:transparent; border:none; color:var(--re); font-size:16px; cursor:pointer; padding:4px 8px; border-radius:4px; transition:background .2s; }
  .ipc-img-preview-remove:hover { background:rgba(255,68,102,.1); }
  .ipc-upload-err { padding:4px 16px; font-family:var(--mo); font-size:10px; color:var(--re); flex-shrink:0; }

  /* ── TYPING ── */
  .ipc-typing { padding:4px 20px; font-family:var(--mo); font-size:11px; color:var(--tm); display:flex; align-items:center; gap:9px; height:28px; flex-shrink:0; opacity:0; transition:opacity .2s; }
  .ipc-typing-on { opacity:1; }
  .ipc-tdots { display:flex; gap:3px; align-items:center; }
  .ipc-tdots span { width:4px; height:4px; background:var(--cd); border-radius:50%; animation:ipcTyping 1.2s infinite; }
  .ipc-tdots span:nth-child(2) { animation-delay:.2s; }
  .ipc-tdots span:nth-child(3) { animation-delay:.4s; }
  @keyframes ipcTyping { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }

  /* ── INPUT BAR ── */
  .ipc-bar { height:68px; background:var(--bg2); border-top:1px solid var(--bo); display:flex; align-items:center; gap:10px; padding:0 14px; flex-shrink:0; }
  .ipc-attach { width:40px; height:40px; min-width:40px; background:transparent; border:1px solid var(--bo); border-radius:var(--ra); color:var(--td); cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .2s; }
  .ipc-attach:hover { border-color:var(--c); color:var(--c); background:var(--cg); }
  .ipc-msg-in { flex:1; background:var(--bg3); border:1px solid var(--bo); border-radius:24px; color:var(--tx); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:16px; font-weight:400; padding:12px 20px; outline:none; transition:border-color .2s,box-shadow .2s; min-width:0; }
  .ipc-msg-in::placeholder { color:var(--tm); }
  .ipc-msg-in:focus { border-color:var(--cd); box-shadow:0 0 0 3px var(--cg); }
  .ipc-send { position:relative; width:44px; height:44px; min-width:44px; background:#7c5cfc; border:none; border-radius:50%; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; transition:transform .15s,box-shadow .2s,background .2s; }
  .ipc-send:hover { background:#9b7ffe; transform:scale(1.08); box-shadow:0 0 20px rgba(124,92,252,.5); }
  .ipc-send:active { transform:scale(.96); }
  .ipc-send-glow { position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,.2),transparent 60%); pointer-events:none; }

  /* ════════════════════════
     MOBILE RESPONSIVE
  ════════════════════════ */
  @media (max-width: 640px) {
    .ipc-hamburger { display:flex; }
    .ipc-sidebar {
      position:fixed; top:0; left:0; bottom:0;
      transform:translateX(-100%); z-index:20; box-shadow:4px 0 30px rgba(0,0,0,.5);
    }
    .ipc-sidebar-open { transform:translateX(0); }
    .ipc-sidebar-backdrop { display:block; }
    .ipc-mwrap { max-width:88%; }
    .ipc-img-bubble { max-width:210px; }
    .ipc-clear-label { display:none; }
    .ipc-badge { max-width:90px; font-size:10px; padding:3px 8px; }
    .ipc-msgs { padding:14px 12px; }
    .ipc-bar  { padding:0 10px; gap:8px; height:64px; }
    .ipc-hid  { max-width:110px; }
    .ipc-bubble { font-size:15px; }
    .ipc-msg-in { font-size:15px; }
  }
`;