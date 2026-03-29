/**
 * ipchat.tsx — UPGRADED v3.0
 * ─────────────────────────────────────────────────────
 * Real-time IP-based chat using Supabase Realtime
 * • NO backend server needed
 * • NO data stored in database — uses Broadcast (ephemeral)
 * • Unlimited users, same "room code" = same channel
 * • Mobile-friendly responsive layout (hamburger sidebar)
 * • Image upload via base64 broadcast (ephemeral, no storage)
 * • Full screen fix (100vh, position fixed)
 *
 * v3.0 UPGRADES:
 * [1] Bigger fonts, readable bubbles, Rajdhani with better letter-spacing
 * [2] Instagram-style reply — double-click or swipe to reply
 * [3] Delete for Everyone on own messages
 * [4] All-Clear Voting System — modal vote, unanimous = restart
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
interface ReplyPreview {
  id: string;
  username: string;
  text: string;
  image?: string;
}

interface ChatMessage {
  id: string;
  type: 'message' | 'system';
  username?: string;
  text: string;
  image?: string;
  timestamp: number;
  isSelf?: boolean;
  systemKind?: 'join' | 'leave' | 'clear' | 'info';
  replyTo?: ReplyPreview;
  deleted?: boolean;
}

interface RoomUser {
  username: string;
  joinedAt: number;
  presenceKey: string;
}

interface ClearVoteState {
  requestedBy: string;
  votes: Record<string, 'accept' | 'reject'>;
  totalMembers: number;
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

  // ── REPLY STATE ──────────────────────────────────────────
  const [replyingTo, setReplyingTo]     = useState<ReplyPreview | null>(null);

  // ── CONTEXT MENU (delete) ────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ msgId: string; x: number; y: number } | null>(null);

  // ── CLEAR VOTE STATE ─────────────────────────────────────
  const [clearVote, setClearVote]               = useState<ClearVoteState | null>(null);
  const [myVote, setMyVote]                     = useState<'accept' | 'reject' | null>(null);
  const [showVoteModal, setShowVoteModal]       = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showAllClearConfirm, setShowAllClearConfirm] = useState(false);

  const myUsername  = useRef('');
  const myRoom      = useRef('');
  const presenceKey = useRef(uid());
  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping    = useRef(false);
  const fileRef     = useRef<HTMLInputElement>(null);
  const msgRefs     = useRef<Record<string, HTMLDivElement | null>>({});
  const touchStartX  = useRef<Record<string, number>>({});
  const membersRef   = useRef<RoomUser[]>([]);
  const prevVotesRef = useRef<string>('');

  // keep membersRef in sync
  useEffect(() => { membersRef.current = members; }, [members]);

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

  // ── SCROLL TO QUOTED MSG ─────────────────────────────────
  const scrollToMsg = useCallback((id: string) => {
    const el = msgRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ipc-msg-highlight');
      setTimeout(() => el.classList.remove('ipc-msg-highlight'), 1500);
    }
  }, []);

  // ── REPLY TRIGGER (double-click) ─────────────────────────
  const handleDoubleClick = useCallback((msg: ChatMessage) => {
    if (msg.type !== 'message' || msg.deleted) return;
    setReplyingTo({
      id: msg.id,
      username: msg.username ?? '',
      text: msg.text,
      image: msg.image,
    });
  }, []);

  // ── SWIPE TO REPLY (touch) ───────────────────────────────
  const handleTouchStart = useCallback((msgId: string, e: React.TouchEvent) => {
    touchStartX.current[msgId] = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((msg: ChatMessage, e: React.TouchEvent) => {
    const startX = touchStartX.current[msg.id] ?? 0;
    const endX   = e.changedTouches[0].clientX;
    const diff   = endX - startX;
    // swipe right ≥ 60px to reply (works for both sides)
    if (Math.abs(diff) >= 60 && msg.type === 'message' && !msg.deleted) {
      setReplyingTo({
        id: msg.id,
        username: msg.username ?? '',
        text: msg.text,
        image: msg.image,
      });
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

    channel.on('presence', { event: 'join' }, ({ newPresences }: any) => {
      const uName = newPresences[0]?.username;
      if (uName && uName !== myUsername.current) {
        addMsg({ id: uid(), type: 'system', text: `${uName} joined the room`, timestamp: Date.now(), systemKind: 'join' });
        scrollBottom();
      }
    });

    channel.on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
      const uName = leftPresences[0]?.username;
      if (uName) {
        addMsg({ id: uid(), type: 'system', text: `${uName} left the room`, timestamp: Date.now(), systemKind: 'leave' });
        setTypingUsers(prev => { const n = new Set(prev); n.delete(uName); return n; });
        scrollBottom();
      }
    });

    // ── BROADCAST: message ──────────────────────────────
    // Apne messages locally already add ho chuke hain (handleSend mein)
    // Sirf dusron ke messages add karo
    channel.on('broadcast', { event: 'message' }, ({ payload }: any) => {
      if (payload.username === myUsername.current) return; // skip own
      addMsg({
        id: payload.id ?? uid(),
        type: 'message',
        username: payload.username,
        text: payload.text,
        image: payload.image,
        timestamp: payload.timestamp,
        isSelf: false,
        replyTo: payload.replyTo ?? undefined,
      });
      scrollBottom();
    });

    // ── BROADCAST: typing ───────────────────────────────
    channel.on('broadcast', { event: 'typing' }, ({ payload }: any) => {
      if (payload.username === myUsername.current) return;
      setTypingUsers(prev => {
        const n = new Set(prev);
        payload.isTyping ? n.add(payload.username) : n.delete(payload.username);
        return n;
      });
    });

    // ── BROADCAST: clear (legacy instant clear) ─────────
    channel.on('broadcast', { event: 'clear' }, ({ payload }: any) => {
      setMessages([{
        id: uid(), type: 'system',
        text: `${payload.username} cleared the chat`,
        timestamp: Date.now(), systemKind: 'clear',
      }]);
      scrollBottom();
    });

    // ── BROADCAST: delete_single ────────────────────────
    channel.on('broadcast', { event: 'delete_single' }, ({ payload }: any) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === payload.msgId
            ? { ...m, deleted: true, text: 'This message was deleted.', image: undefined, replyTo: undefined }
            : m
        )
      );
    });

    // ── BROADCAST: request_all_clear ────────────────────
    // NOTE: Supabase sender ko deliver nahi karta — requester ka state
    // handleRequestAllClear mein locally set hota hai
    channel.on('broadcast', { event: 'request_all_clear' }, ({ payload }: any) => {
      // Sirf non-requesters yahan pahunchte hain
      const totalOthers = membersRef.current.length - 1;
      setClearVote({
        requestedBy: payload.requestedBy,
        votes: { [payload.requestedBy]: 'accept' }, // requester auto-accept
        totalMembers: totalOthers,
      });
      setMyVote(null);
      setShowVoteModal(true);
    });

    // ── BROADCAST: all_clear_vote ───────────────────────
    // Sirf votes update karo — majority check useEffect mein hoga
    channel.on('broadcast', { event: 'all_clear_vote' }, ({ payload }: any) => {
      setClearVote(prev => {
        if (!prev) return prev;
        return { ...prev, votes: { ...prev.votes, [payload.username]: payload.vote } };
      });
    });

    // ── BROADCAST: force_clear_all ──────────────────────
    // Receivers (non-requester) — complete fresh reset
    channel.on('broadcast', { event: 'force_clear_all' }, ({ payload }: any) => {
      const { requestedBy, acceptCount, rejectCount } = payload;
      const summary = acceptCount != null ? ` (${acceptCount} accept, ${rejectCount} reject)` : '';
      setMessages([{
        id: uid(), type: 'system',
        text: `— Fresh start by ${requestedBy}${summary} —`,
        timestamp: Date.now(), systemKind: 'clear',
      }]);
      setShowVoteModal(false);
      setClearVote(null);
      setMyVote(null);
      setReplyingTo(null);
      setImagePreview(null);
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
  // Supabase broadcast apne sender ko deliver NAHI karta
  // isliye apna message locally turant add karo
  const handleSend = useCallback(async () => {
    const msg = sanitize(msgInput);
    if ((!msg && !imagePreview) || !channelRef.current) return;

    const msgId  = uid();
    const ts     = Date.now();
    const imgVal = imagePreview ?? undefined;
    const rTo    = replyingTo ?? undefined;

    // Locally apna message turant dikhao
    addMsg({
      id: msgId,
      type: 'message',
      username: myUsername.current,
      text: msg,
      image: imgVal,
      timestamp: ts,
      isSelf: true,
      replyTo: rTo,
    });
    scrollBottom();

    // Baaki members ko broadcast karo
    await channelRef.current.send({
      type: 'broadcast',
      event: 'message',
      payload: {
        id: msgId,
        username: myUsername.current,
        text: msg,
        image: imgVal,
        timestamp: ts,
        replyTo: rTo,
      },
    });

    setMsgInput('');
    setImagePreview(null);
    setReplyingTo(null);
    stopTyping();
  }, [msgInput, imagePreview, replyingTo, addMsg, scrollBottom]);

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

  // ── DELETE FOR EVERYONE ───────────────────────────────────
  const handleDeleteForEveryone = useCallback(async (msgId: string) => {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type: 'broadcast', event: 'delete_single',
      payload: { msgId },
    });
    setCtxMenu(null);
  }, []);

  // ── ALL CLEAR REQUEST (voting) ────────────────────────────
  const handleRequestAllClear = useCallback(async () => {
    if (!channelRef.current) return;
    // Requester ka state locally set karo — Supabase broadcast sender ko deliver nahi karta
    const totalOthers = membersRef.current.length - 1;
    setClearVote({
      requestedBy: myUsername.current,
      votes: { [myUsername.current]: 'accept' }, // requester auto-accept
      totalMembers: totalOthers,
    });
    setMyVote('accept');
    setShowVoteModal(false);
    // Baaki members ko broadcast karo
    await channelRef.current.send({
      type: 'broadcast', event: 'request_all_clear',
      payload: { requestedBy: myUsername.current },
    });
  }, []);

  // ── CAST VOTE ─────────────────────────────────────────────
  const castVote = useCallback(async (vote: 'accept' | 'reject') => {
    if (!channelRef.current || myVote) return;
    setMyVote(vote);
    // Local state update — voter apna vote local mein set kare
    setClearVote(prev => {
      if (!prev) return prev;
      return { ...prev, votes: { ...prev.votes, [myUsername.current]: vote } };
    });
    // Broadcast to room — Supabase sender ko deliver nahi karta
    // isliye voter apne liye manually checkMajority chalayega (useEffect se)
    await channelRef.current.send({
      type: 'broadcast', event: 'all_clear_vote',
      payload: { username: myUsername.current, vote },
    });
  }, [myVote]);

  // ── MAJORITY CHECK (voter side) ────────────────────────────
  // Supabase apne broadcast sender ko deliver nahi karta
  // isliye jab clearVote.votes change ho, har client majority check kare
  useEffect(() => {
    if (!clearVote) return;
    const votesKey = JSON.stringify(clearVote.votes);
    if (votesKey === prevVotesRef.current) return;
    prevVotesRef.current = votesKey;

    const otherUsernames = membersRef.current
      .map(m => m.username)
      .filter(u => u !== clearVote.requestedBy);

    const castedVotes = otherUsernames
      .map(u => clearVote.votes[u])
      .filter((v): v is string => v === 'accept' || v === 'reject');

    const acceptCount = castedVotes.filter(v => v === 'accept').length;
    const rejectCount = castedVotes.filter(v => v === 'reject').length;
    const allVoted    = otherUsernames.length > 0 && castedVotes.length >= otherUsernames.length;

    if (!allVoted) return;

    const majorityAccepted = acceptCount > rejectCount;

    if (majorityAccepted) {
      // Sirf requester force_clear_all bheje
      if (myUsername.current === clearVote.requestedBy && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast', event: 'force_clear_all',
          payload: { requestedBy: clearVote.requestedBy, acceptCount, rejectCount },
        });
        // Requester apna chat bhi locally reset kare — broadcast woh receive nahi karta
        const summary = ` (${acceptCount} accept, ${rejectCount} reject)`;
        setMessages([{
          id: uid(), type: 'system',
          text: `— Fresh start by ${clearVote.requestedBy}${summary} —`,
          timestamp: Date.now(), systemKind: 'clear',
        }]);
        setClearVote(null);
        setMyVote(null);
        setShowVoteModal(false);
        setReplyingTo(null);
        setImagePreview(null);
      }
    } else {
      setTimeout(() => {
        setShowVoteModal(false);
        setClearVote(null);
        setMyVote(null);
      }, 1200);
      addMsg({
        id: uid(), type: 'system',
        text: `Restart rejected (${acceptCount} accept, ${rejectCount} reject) — conversation continues.`,
        timestamp: Date.now(), systemKind: 'info',
      });
    }
  }, [clearVote, addMsg]);

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
    setReplyingTo(null);
    setClearVote(null);
    setShowVoteModal(false);
    setShowClearConfirm(false);
    setShowAllClearConfirm(false);
    setMyVote(null);
    setCtxMenu(null);
    myUsername.current = '';
    myRoom.current = '';
  }, [cleanup, stopTyping]);

  useEffect(() => () => { cleanup(); }, [cleanup]);

  // close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => setCtxMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [ctxMenu]);

  const onJoinKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleJoin(); };
  const onMsgKey  = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleSend(); };

  const typingArr = Array.from(typingUsers);
  const typingLabel = typingArr.length === 1
    ? `${typingArr[0]} is typing`
    : typingArr.length > 1
    ? `${typingArr.join(', ')} are typing`
    : '';

  const onlineCount = members.length;

  // vote summary
  // voteAccepted/Rejected — live membersRef se compute (totalMembers timing bug fix)
  const voteAccepted = clearVote
    ? Object.entries(clearVote.votes).filter(([u, v]) => u !== clearVote.requestedBy && v === 'accept').length
    : 0;
  const voteRejected = clearVote
    ? Object.entries(clearVote.votes).filter(([u, v]) => u !== clearVote.requestedBy && v === 'reject').length
    : 0;
  // "of N" = live non-requester member count
  const voteTotal = clearVote
    ? members.filter(m => m.username !== clearVote.requestedBy).length
    : 0;

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

      {/* ── CONTEXT MENU ── */}
      {ctxMenu && (
        <div
          className="ipc-ctx-menu"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="ipc-ctx-item ipc-ctx-danger"
            onClick={() => handleDeleteForEveryone(ctxMenu.msgId)}
          >
            🗑 Delete for Everyone
          </button>
          <button className="ipc-ctx-item" onClick={() => setCtxMenu(null)}>Cancel</button>
        </div>
      )}

      {/* ── CLEAR CONFIRM MODAL ── */}
      {showClearConfirm && (
        <div className="ipc-modal-backdrop">
          <div className="ipc-modal ipc-confirm-modal">
            <div className="ipc-modal-icon">🗑</div>
            <div className="ipc-modal-title">Delete My Messages</div>
            <div className="ipc-modal-body">
              Your messages will be deleted for <strong>everyone</strong> in this room.
              <br />This cannot be undone.
            </div>
            <div className="ipc-modal-btns">
              <button className="ipc-modal-btn ipc-btn-reject" onClick={() => setShowClearConfirm(false)}>
                Cancel
              </button>
              <button className="ipc-modal-btn ipc-btn-accept" onClick={() => {
                setShowClearConfirm(false);
                if (!channelRef.current) return;
                setMessages(prev => {
                  const myMsgs = prev.filter(m => m.type === 'message' && m.isSelf && !m.deleted);
                  myMsgs.forEach(m => {
                    channelRef.current?.send({ type:'broadcast', event:'delete_single', payload:{ msgId: m.id } });
                  });
                  return prev.map(m =>
                    m.isSelf && m.type === 'message' && !m.deleted
                      ? { ...m, deleted: true, text: 'This message was deleted.', image: undefined, replyTo: undefined }
                      : m
                  );
                });
              }}>
                ✓ Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ALL CLEAR CONFIRM MODAL ── */}
      {showAllClearConfirm && (
        <div className="ipc-modal-backdrop">
          <div className="ipc-modal ipc-confirm-modal">
            <div className="ipc-modal-icon">🔄</div>
            <div className="ipc-modal-title">Request Fresh Start</div>
            <div className="ipc-modal-body">
              A vote will be sent to all room members.
              <br /><strong>Majority accept</strong> = fresh conversation starts.
              <br /><strong>Equal or more reject</strong> = conversation continues.
            </div>
            <div className="ipc-modal-btns">
              <button className="ipc-modal-btn ipc-btn-reject" onClick={() => setShowAllClearConfirm(false)}>
                Cancel
              </button>
              <button className="ipc-modal-btn ipc-btn-accept" onClick={() => {
                setShowAllClearConfirm(false);
                handleRequestAllClear();
              }}>
                ✓ Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VOTE MODAL — sirf non-requester members ko dikhta hai ── */}
      {showVoteModal && clearVote && (
        <div className="ipc-modal-backdrop">
          <div className="ipc-modal">
            <div className="ipc-modal-icon">🔄</div>
            <div className="ipc-modal-title">Restart Request</div>
            <div className="ipc-modal-body">
              <strong>{clearVote.requestedBy}</strong> wants to start a fresh conversation.
              <br />Majority accept = restart. Equal or more reject = continue.
            </div>
            <div className="ipc-modal-votes">
              <span className="ipc-vote-accept">✓ {voteAccepted} accepted</span>
              <span className="ipc-vote-reject">✕ {voteRejected} rejected</span>
              <span className="ipc-vote-total">of {voteTotal}</span>
            </div>
            {!myVote ? (
              <div className="ipc-modal-btns">
                <button className="ipc-modal-btn ipc-btn-accept" onClick={() => castVote('accept')}>
                  ✓ Accept
                </button>
                <button className="ipc-modal-btn ipc-btn-reject" onClick={() => castVote('reject')}>
                  ✕ Reject
                </button>
              </div>
            ) : (
              <div className="ipc-modal-voted">
                You voted: <strong className={myVote === 'accept' ? 'ipc-voted-yes' : 'ipc-voted-no'}>
                  {myVote === 'accept' ? '✓ Accept' : '✕ Reject'}
                </strong>
                <br /><span className="ipc-modal-waiting">Waiting for others…</span>
              </div>
            )}
          </div>
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
            <div className="ipc-brand-footer">
              crafted by <span className="ipc-brand-name">AxelleVault</span>
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
              <div className="ipc-ver">
                <span style={{color:'var(--tm)'}}>made by</span>
                <span className="ipc-brand-tag"> AxelleVault</span>
              </div>
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
                {/* CLEAR — confirmation + apne messages delete */}
                <button className="ipc-clear-btn ipc-clear-mine" onClick={() => setShowClearConfirm(true)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/>
                  </svg>
                  <span className="ipc-clear-label">CLEAR</span>
                </button>
                {/* ALL CLEAR — confirmation then voting */}
                <button className="ipc-clear-btn ipc-allclear-btn" onClick={() => setShowAllClearConfirm(true)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span className="ipc-clear-label">ALL CLEAR</span>
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
                  <div
                    key={msg.id}
                    className={`ipc-mwrap ${msg.isSelf ? 'ipc-self' : 'ipc-other'} ${msg.deleted ? 'ipc-deleted' : ''}`}
                    ref={el => { msgRefs.current[msg.id] = el; }}
                    onDoubleClick={() => handleDoubleClick(msg)}
                    onTouchStart={e => handleTouchStart(msg.id, e)}
                    onTouchEnd={e => handleTouchEnd(msg, e)}
                    onContextMenu={msg.isSelf && !msg.deleted ? (e) => {
                      e.preventDefault();
                      setCtxMenu({ msgId: msg.id, x: e.clientX, y: e.clientY });
                    } : undefined}
                  >
                    <div className="ipc-mmeta">
                      {!msg.isSelf && <span className="ipc-muser">{msg.username}</span>}
                      <span className="ipc-mtime">{fmtTime(msg.timestamp)}</span>
                      {/* Reply hint */}
                      {!msg.deleted && (
                        <button
                          className="ipc-reply-hint"
                          title="Reply"
                          onClick={() => handleDoubleClick(msg)}
                        >↩</button>
                      )}
                    </div>

                    {/* Reply preview */}
                    {msg.replyTo && !msg.deleted && (
                      <div
                        className="ipc-reply-preview"
                        onClick={() => scrollToMsg(msg.replyTo!.id)}
                        title="Jump to original"
                      >
                        <div className="ipc-reply-preview-user">{msg.replyTo.username}</div>
                        <div className="ipc-reply-preview-text">
                          {msg.replyTo.image && !msg.replyTo.text && '📷 Image'}
                          {msg.replyTo.text && msg.replyTo.text.slice(0, 80)}
                        </div>
                      </div>
                    )}

                    {msg.image && !msg.deleted && (
                      <div className="ipc-img-bubble" onClick={() => setLightbox(msg.image!)}>
                        <img src={msg.image} alt="shared" className="ipc-img-thumb" />
                        <div className="ipc-img-overlay">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                          </svg>
                        </div>
                      </div>
                    )}
                    <div className={`ipc-bubble ${msg.deleted ? 'ipc-bubble-deleted' : ''}`}>
                      {msg.text || (msg.deleted ? 'This message was deleted.' : '')}
                    </div>
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

            {/* REPLY BAR */}
            {replyingTo && (
              <div className="ipc-reply-bar">
                <div className="ipc-reply-bar-inner">
                  <div className="ipc-reply-bar-accent" />
                  <div className="ipc-reply-bar-content">
                    <div className="ipc-reply-bar-user">↩ Replying to {replyingTo.username}</div>
                    <div className="ipc-reply-bar-text">
                      {replyingTo.image && !replyingTo.text && '📷 Image'}
                      {replyingTo.text && replyingTo.text.slice(0, 80)}
                    </div>
                  </div>
                </div>
                <button className="ipc-reply-cancel" onClick={() => setReplyingTo(null)}>✕</button>
              </div>
            )}

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
              <input className="ipc-msg-in" type="text" placeholder="Type a message…"
                value={msgInput} maxLength={500} autoComplete="off" spellCheck={false}
                inputMode="text"
                enterKeyHint="send"
                onChange={handleMsgInput} onKeyDown={onMsgKey}
                onFocus={e => {
                  // iOS: scroll input into view when keyboard opens
                  setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300);
                }} />
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
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Share+Tech+Mono&display=swap');

  /* ── FULL SCREEN FIX ── */
  html, body { height:100%; margin:0; padding:0; overflow:hidden; }
  #root { height:100%; width:100%; }



  /* ── MOBILE VIEWPORT FIX ── */
  /* Use dvh (dynamic viewport height) — shrinks when keyboard opens */
  .ipc-chat-root {
    height: 100dvh;
    height: 100vh; /* fallback */
  }

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

  .ipc-logo  { text-align:center; font-family:var(--sp); font-size:clamp(24px,5vw,34px); font-weight:700; letter-spacing:6px; margin-bottom:10px; }
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
    width:260px; min-width:260px; height:100%;
    background:var(--bg2); border-right:1px solid var(--bo);
    display:flex; flex-direction:column; flex-shrink:0; position:relative; z-index:20;
    transition:transform .3s cubic-bezier(.22,1,.36,1);
  }
  .ipc-sidebar-logo { padding:22px 20px 16px; font-family:var(--sp); font-size:17px; font-weight:700; letter-spacing:4px; border-bottom:1px solid var(--bo); }
  .ipc-room-box  { margin:12px 12px 0; background:rgba(0,212,255,.04); border:1px solid rgba(0,212,255,.12); border-radius:var(--ra); padding:12px 14px; }
  .ipc-room-lbl  { font-family:var(--mo); font-size:11px; letter-spacing:2px; color:var(--tm); margin-bottom:6px; }
  .ipc-room-ip   { font-family:var(--mo); font-size:15px; color:var(--c); letter-spacing:1px; margin-bottom:8px; word-break:break-all; }
  .ipc-room-online { font-family:var(--mo); font-size:13px; color:var(--td); display:flex; align-items:center; gap:6px; }
  .ipc-pulse { width:7px; height:7px; background:var(--gr); border-radius:50%; display:inline-block; box-shadow:0 0 6px var(--gr); animation:ipcPulse 2s ease-in-out infinite; }
  @keyframes ipcPulse { 0%,100%{opacity:1;box-shadow:0 0 6px var(--gr)} 50%{opacity:.6;box-shadow:0 0 12px var(--gr)} }

  .ipc-members   { flex:1; overflow-y:auto; padding:12px 12px 0; scrollbar-width:thin; scrollbar-color:var(--bo) transparent; }
  .ipc-mem-lbl   { font-family:var(--mo); font-size:11px; letter-spacing:2px; color:var(--tm); margin-bottom:10px; }
  .ipc-mem-list  { list-style:none; display:flex; flex-direction:column; gap:3px; }
  .ipc-mem-item  { display:flex; align-items:center; gap:8px; padding:9px 10px; border-radius:4px; font-family:var(--mo); font-size:14px; color:var(--tx); animation:ipcMemIn .3s ease both; }
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

  .ipc-header { height:64px; background:var(--bg2); border-bottom:1px solid var(--bo); display:flex; align-items:center; justify-content:space-between; padding:0 20px; flex-shrink:0; gap:10px; }
  .ipc-hroom  { font-family:var(--mo); font-size:16px; display:flex; align-items:center; gap:8px; flex:1; min-width:0; overflow:hidden; }
  .ipc-hpre   { color:var(--tm); letter-spacing:1px; flex-shrink:0; }
  .ipc-hid    { color:var(--c); letter-spacing:1px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ipc-hactions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
  .ipc-clear-btn { background:transparent; border:1px solid var(--bo); border-radius:4px; color:var(--td); font-family:var(--mo); font-size:10px; letter-spacing:1.5px; padding:5px 10px; cursor:pointer; display:flex; align-items:center; gap:5px; transition:all .2s; }
  .ipc-clear-btn:hover { border-color:rgba(255,68,102,.4); color:var(--re); background:rgba(255,68,102,.06); }
  .ipc-allclear-btn { border-color:rgba(0,212,255,.25) !important; color:var(--cd) !important; }
  .ipc-allclear-btn:hover { border-color:var(--c) !important; color:var(--c) !important; background:rgba(0,212,255,.06) !important; }
  .ipc-clear-label { display:inline; }
  .ipc-badge  { display:flex; align-items:center; gap:6px; font-family:var(--mo); font-size:14px; color:var(--tx); background:var(--bg3); border:1px solid var(--bo); border-radius:4px; padding:5px 12px; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ipc-badge-dot { width:6px; height:6px; background:var(--gr); border-radius:50%; box-shadow:0 0 6px var(--gr); flex-shrink:0; }

  /* ── MESSAGES ── */
  .ipc-msgs { flex:1; overflow-y:auto; padding:20px 20px; display:flex; flex-direction:column; gap:2px; scrollbar-width:thin; scrollbar-color:var(--bo) transparent; }
  .ipc-msgs::-webkit-scrollbar { width:4px; }
  .ipc-msgs::-webkit-scrollbar-thumb { background:var(--bo); border-radius:2px; }

  .ipc-sys { align-self:center; font-family:var(--mo); font-size:12px; color:var(--tm); letter-spacing:.5px; padding:5px 14px; background:rgba(255,255,255,.02); border:1px solid var(--bo); border-radius:20px; text-align:center; animation:ipcMsgIn .25s ease both; margin:8px 0; }
  .ipc-sys-join  { color:rgba(0,255,136,.7);  border-color:rgba(0,255,136,.15); }
  .ipc-sys-leave { color:rgba(255,68,102,.7); border-color:rgba(255,68,102,.12); }
  .ipc-sys-clear { color:rgba(0,212,255,.6);  border-color:rgba(0,212,255,.12); }

  .ipc-mwrap {
    display:flex; flex-direction:column;
    max-width:68%;
    animation:ipcMsgIn .25s cubic-bezier(.22,1,.36,1) both;
    margin-bottom:12px;
    cursor:default;
    user-select:text;
    transition:background .15s;
  }
  @keyframes ipcMsgIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  .ipc-self  { align-self:flex-end;   align-items:flex-end; }
  .ipc-other { align-self:flex-start; align-items:flex-start; }

  /* Highlight on scroll-to */
  .ipc-msg-highlight { animation:ipcHighlight .8s ease; }
  @keyframes ipcHighlight { 0%,100%{background:transparent} 30%{background:rgba(0,212,255,0.08)} }

  .ipc-mmeta { display:flex; align-items:center; gap:8px; margin-bottom:5px; }
  /* [1] Bigger username font */
  .ipc-muser { font-family:var(--mo); font-size:13px; font-weight:400; color:var(--cd); letter-spacing:.5px; }
  .ipc-mtime { font-family:var(--mo); font-size:12px; color:var(--tm); }

  /* ── REPLY HINT BUTTON ── */
  .ipc-reply-hint {
    background:transparent; border:none; color:var(--tm); font-size:14px;
    cursor:pointer; padding:0 4px; opacity:0; transition:opacity .2s, color .2s;
    line-height:1;
  }
  .ipc-mwrap:hover .ipc-reply-hint { opacity:1; }
  .ipc-reply-hint:hover { color:var(--c); }

  /* ── REPLY PREVIEW (inside bubble) ── */
  .ipc-reply-preview {
    background:rgba(0,212,255,0.05);
    border-left:3px solid var(--cd);
    border-radius:6px 6px 0 0;
    padding:7px 12px 6px;
    margin-bottom:2px;
    max-width:100%;
    cursor:pointer;
    transition:background .2s;
  }
  .ipc-self .ipc-reply-preview {
    border-left-color:#a08aff;
    background:rgba(124,92,252,0.12);
  }
  .ipc-reply-preview:hover { background:rgba(0,212,255,0.1); }
  .ipc-self .ipc-reply-preview:hover { background:rgba(124,92,252,0.2); }
  .ipc-reply-preview-user {
    font-family:var(--sa); font-size:12px; font-weight:700;
    color:var(--cd); letter-spacing:.5px; margin-bottom:2px;
  }
  .ipc-self .ipc-reply-preview-user { color:#b8a0ff; }
  .ipc-reply-preview-text {
    font-family:var(--sa); font-size:13px; color:var(--td);
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px;
  }

  /* ── BUBBLES — bigger, Rajdhani forced ── */
  .ipc-bubble {
    padding:13px 20px !important;
    border-radius:20px !important;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif !important;
    font-size:20px !important;
    font-weight:400 !important;
    line-height:1.5 !important;
    letter-spacing:0px !important;
    max-width:100%;
    word-break:break-word;
    min-width:60px;
    width:fit-content;
    display:block;
  }
  /* YOUR messages — solid purple */
  .ipc-self .ipc-bubble {
    background:#7c5cfc !important;
    color:#fff !important;
    border:none !important;
    border-bottom-right-radius:5px !important;
    box-shadow:0 4px 20px rgba(124,92,252,0.45) !important;
  }
  /* OTHER messages — dark card */
  .ipc-other .ipc-bubble {
    background:#1e2a40 !important;
    border:1px solid #2a3a58 !important;
    color:#e8f4ff !important;
    border-bottom-left-radius:5px !important;
  }
  /* Deleted message style */
  .ipc-bubble-deleted {
    font-style:italic !important;
    opacity:0.45 !important;
    font-size:14px !important;
  }
  .ipc-self.ipc-deleted .ipc-bubble {
    background:#3a2a6a !important;
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

  /* ── CONTEXT MENU ── */
  .ipc-ctx-menu {
    position:fixed; z-index:500;
    background:var(--bg2); border:1px solid var(--bo2);
    border-radius:8px; overflow:hidden;
    box-shadow:0 8px 32px rgba(0,0,0,.6);
    animation:ipcIn .15s ease both;
    min-width:180px;
  }
  .ipc-ctx-item {
    display:block; width:100%; text-align:left;
    background:transparent; border:none;
    color:var(--tx); font-family:var(--sa); font-size:14px; font-weight:500;
    padding:11px 16px; cursor:pointer; letter-spacing:.3px;
    transition:background .15s;
  }
  .ipc-ctx-item:hover { background:rgba(255,255,255,.05); }
  .ipc-ctx-danger { color:var(--re) !important; }
  .ipc-ctx-danger:hover { background:rgba(255,68,102,.08) !important; }

  /* ── IMAGE PREVIEW BAR ── */
  .ipc-img-preview-bar { display:flex; align-items:center; gap:10px; padding:8px 16px; background:rgba(124,92,252,.08); border-top:1px solid rgba(124,92,252,.2); flex-shrink:0; }
  .ipc-img-preview-thumb { width:42px; height:42px; object-fit:cover; border-radius:6px; border:1px solid rgba(124,92,252,.3); }
  .ipc-img-preview-label { font-family:var(--mo); font-size:10px; color:var(--cd); letter-spacing:.5px; flex:1; }
  .ipc-img-preview-remove { background:transparent; border:none; color:var(--re); font-size:16px; cursor:pointer; padding:4px 8px; border-radius:4px; transition:background .2s; }
  .ipc-img-preview-remove:hover { background:rgba(255,68,102,.1); }
  .ipc-upload-err { padding:4px 16px; font-family:var(--mo); font-size:10px; color:var(--re); flex-shrink:0; }

  /* ── REPLY BAR ── */
  .ipc-reply-bar {
    display:flex; align-items:center; justify-content:space-between;
    padding:8px 14px; background:rgba(0,212,255,.04);
    border-top:1px solid rgba(0,212,255,.12); flex-shrink:0;
    animation:ipcIn .2s ease both;
  }
  .ipc-reply-bar-inner { display:flex; align-items:stretch; gap:10px; flex:1; min-width:0; }
  .ipc-reply-bar-accent { width:3px; border-radius:2px; background:var(--cd); flex-shrink:0; }
  .ipc-reply-bar-content { display:flex; flex-direction:column; gap:2px; min-width:0; }
  .ipc-reply-bar-user { font-family:var(--sa); font-size:12px; font-weight:700; color:var(--cd); letter-spacing:.5px; }
  .ipc-reply-bar-text { font-family:var(--sa); font-size:13px; color:var(--td); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:320px; }
  .ipc-reply-cancel { background:transparent; border:none; color:var(--tm); font-size:18px; cursor:pointer; padding:4px 8px; border-radius:4px; transition:all .2s; flex-shrink:0; }
  .ipc-reply-cancel:hover { color:var(--re); background:rgba(255,68,102,.08); }

  /* ── TYPING ── */
  .ipc-typing { padding:4px 20px; font-family:var(--mo); font-size:11px; color:var(--tm); display:flex; align-items:center; gap:9px; height:28px; flex-shrink:0; opacity:0; transition:opacity .2s; }
  .ipc-typing-on { opacity:1; }
  .ipc-tdots { display:flex; gap:3px; align-items:center; }
  .ipc-tdots span { width:4px; height:4px; background:var(--cd); border-radius:50%; animation:ipcTyping 1.2s infinite; }
  .ipc-tdots span:nth-child(2) { animation-delay:.2s; }
  .ipc-tdots span:nth-child(3) { animation-delay:.4s; }
  @keyframes ipcTyping { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }

  /* ── INPUT BAR ── */
  .ipc-bar { height:78px; background:var(--bg2); border-top:1px solid var(--bo); display:flex; align-items:center; gap:12px; padding:0 18px; flex-shrink:0; }
  .ipc-attach { width:46px; height:46px; min-width:46px; background:transparent; border:1px solid var(--bo); border-radius:var(--ra); color:var(--td); cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .2s; }
  .ipc-attach:hover { border-color:var(--c); color:var(--c); background:var(--cg); }
  /* [1] bigger input font — forced */
  .ipc-msg-in {
    flex:1; background:var(--bg3); border:1px solid var(--bo); border-radius:24px;
    color:var(--tx) !important;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif !important;
    font-size:16px !important;
    font-weight:400 !important;
    letter-spacing:0px;
    padding:11px 18px; outline:none;
    transition:border-color .2s,box-shadow .2s; min-width:0;
  }
  .ipc-msg-in::placeholder { color:var(--tm); font-size:14px; }
  .ipc-msg-in:focus { border-color:var(--cd); box-shadow:0 0 0 3px var(--cg); }
  .ipc-send { position:relative; width:50px; height:50px; min-width:50px; background:#7c5cfc; border:none; border-radius:50%; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; transition:transform .15s,box-shadow .2s,background .2s; }
  .ipc-send:hover { background:#9b7ffe; transform:scale(1.08); box-shadow:0 0 20px rgba(124,92,252,.5); }
  .ipc-send:active { transform:scale(.96); }
  .ipc-send-glow { position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,.2),transparent 60%); pointer-events:none; }

  /* ── CONFIRM MODAL (smaller) ── */
  .ipc-confirm-modal {
    max-width:360px !important;
    padding:32px 28px !important;
  }
  .ipc-confirm-modal .ipc-modal-icon { font-size:30px; margin-bottom:10px; }
  .ipc-confirm-modal .ipc-modal-title { font-size:13px; }
  .ipc-confirm-modal .ipc-modal-body { font-size:15px; margin-bottom:20px; }

  /* ── ALL MODALS — backdrop + card ── */
  .ipc-modal-backdrop {
    position:fixed; inset:0; z-index:900;
    /* Solid enough to see modal clearly on dark bg */
    background:rgba(2,6,18,0.88);
    backdrop-filter:blur(12px);
    -webkit-backdrop-filter:blur(12px);
    display:flex; align-items:center; justify-content:center;
    padding:20px;
    animation:ipcIn .2s ease both;
  }
  .ipc-modal {
    /* Solid dark card — no transparency blending with chat bg */
    background:#0f1829;
    border:1px solid rgba(0,212,255,0.35);
    border-radius:18px;
    padding:36px 32px;
    max-width:400px; width:92vw;
    /* Strong glow so it pops on any bg */
    box-shadow:
      0 0 0 1px rgba(0,212,255,0.15),
      0 0 40px rgba(0,212,255,0.12),
      0 32px 80px rgba(0,0,0,0.9);
    text-align:center;
    animation:ipcIn .3s cubic-bezier(.22,1,.36,1) both;
    position:relative;
  }
  /* Top accent line */
  .ipc-modal::before {
    content:'';
    position:absolute; top:0; left:10%; right:10%; height:2px;
    background:linear-gradient(90deg,transparent,rgba(0,212,255,0.6),transparent);
    border-radius:2px;
  }
  .ipc-modal-icon  { font-size:36px; margin-bottom:12px; }
  .ipc-modal-title {
    font-family:var(--sp); font-size:13px; letter-spacing:4px;
    color:var(--c); text-transform:uppercase; margin-bottom:14px;
    text-shadow:0 0 12px rgba(0,212,255,0.5);
  }
  .ipc-modal-body  {
    font-family:var(--sa); font-size:16px; font-weight:500;
    color:#c8d8f0; line-height:1.65; margin-bottom:22px;
  }
  .ipc-modal-body strong { color:#fff; font-weight:700; }
  .ipc-modal-votes {
    display:flex; gap:16px; justify-content:center; margin-bottom:24px;
    font-family:var(--mo); font-size:12px; flex-wrap:wrap;
    background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.06);
    border-radius:8px; padding:10px 16px;
  }
  .ipc-vote-accept { color:#00ff88; font-weight:700; }
  .ipc-vote-reject { color:#ff4466; font-weight:700; }
  .ipc-vote-total  { color:#5a7090; }
  .ipc-modal-btns  { display:flex; gap:12px; justify-content:center; }
  .ipc-modal-btn {
    flex:1; max-width:150px;
    border:none; border-radius:10px; padding:13px 20px;
    font-family:var(--sp); font-size:11px; font-weight:700;
    letter-spacing:2px; cursor:pointer; transition:all .2s;
    min-height:46px;
  }
  .ipc-btn-accept { background:#00ff88; color:#030a06; box-shadow:0 0 20px rgba(0,255,136,0.3); }
  .ipc-btn-accept:hover { background:#33ffaa; box-shadow:0 0 24px rgba(0,255,136,.5); transform:translateY(-1px); }
  .ipc-btn-reject { background:rgba(255,68,102,0.15); color:#ff6680; border:1px solid rgba(255,68,102,0.4); }
  .ipc-btn-reject:hover { background:rgba(255,68,102,0.25); box-shadow:0 0 18px rgba(255,68,102,.3); color:#fff; }
  .ipc-modal-voted { font-family:var(--sa); font-size:16px; color:#a0b4d0; }
  /* ── BRANDING ── */
  .ipc-brand-tag {
    font-family:var(--sp); font-size:9px; letter-spacing:1.5px;
    color:var(--c); text-shadow:0 0 8px rgba(0,212,255,0.5);
    font-weight:700;
  }
  .ipc-brand-footer {
    text-align:center; margin-top:14px;
    font-family:var(--mo); font-size:9.5px; color:var(--tm);
    letter-spacing:0.5px;
  }
  .ipc-brand-name {
    color:var(--c); font-weight:700; letter-spacing:1px;
    text-shadow:0 0 8px rgba(0,212,255,0.4);
  }
  .ipc-modal-voted strong { color:var(--tx); }
  .ipc-voted-yes { color:var(--gr) !important; }
  .ipc-voted-no  { color:var(--re) !important; }
  .ipc-modal-waiting { font-family:var(--mo); font-size:11px; color:var(--tm); letter-spacing:.5px; margin-top:6px; display:block; }

  /* ════════════════════════
     MOBILE RESPONSIVE — full keyboard fix
  ════════════════════════ */

  /* iOS Safari 100vh bug fix — use dvh where supported */
  @supports (height: 100dvh) {
    .ipc-wrap, .ipc-chat-root {
      height: 100dvh !important;
    }
  }

  @media (max-width: 640px) {
    /* ── Layout: use dvh, avoid fixed overflow:hidden conflicts ── */
    html, body {
      height: 100% !important;
      overflow: hidden !important;
      /* Prevent iOS bounce scroll */
      overscroll-behavior: none;
    }

    .ipc-wrap {
      height: 100svh !important;
      height: 100dvh !important;
    }

    /* Chat root — fill screen, flex column, let keyboard push it */
    .ipc-chat-root {
      position: fixed !important;
      top: 0; left: 0; right: 0; bottom: 0;
      height: 100% !important;
      /* env(safe-area-inset-bottom) for iPhone notch */
      padding-bottom: env(safe-area-inset-bottom);
    }

    /* Main area — fill remaining, flex column */
    .ipc-main {
      display: flex !important;
      flex-direction: column !important;
      height: 100% !important;
      overflow: hidden !important;
    }

    /* Messages area — flex:1 so it shrinks when keyboard opens */
    .ipc-msgs {
      flex: 1 1 0% !important;
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch !important;
      padding: 14px 12px !important;
      /* Prevent overscroll */
      overscroll-behavior-y: contain;
    }

    /* Input bar — always at bottom, never hidden behind keyboard */
    .ipc-bar {
      flex-shrink: 0 !important;
      position: relative !important;
      padding: 8px 10px !important;
      padding-bottom: max(8px, env(safe-area-inset-bottom)) !important;
      height: auto !important;
      min-height: 60px;
      gap: 8px;
      /* Ensure tappable */
      z-index: 10;
    }

    /* Input field — bigger tap target, no zoom on iOS (font>=16px prevents zoom) */
    .ipc-msg-in {
      font-size: 16px !important;
      padding: 10px 16px !important;
      min-height: 44px !important;
      /* Prevent iOS from zooming in */
      -webkit-text-size-adjust: 100%;
    }

    /* Send button — bigger tap target */
    .ipc-send {
      width: 44px !important;
      height: 44px !important;
      min-width: 44px !important;
      flex-shrink: 0 !important;
    }

    /* Attach button */
    .ipc-attach {
      width: 40px !important;
      height: 40px !important;
      min-width: 40px !important;
      flex-shrink: 0 !important;
    }

    /* Sidebar — slide in from left */
    .ipc-hamburger { display:flex; }
    .ipc-sidebar {
      position:fixed; top:0; left:0; bottom:0;
      transform:translateX(-100%); z-index:20;
      box-shadow:4px 0 30px rgba(0,0,0,.5);
      height: 100% !important;
    }
    .ipc-sidebar-open { transform:translateX(0); }
    .ipc-sidebar-backdrop { display:block; }

    /* Messages */
    .ipc-mwrap { max-width:88%; }
    .ipc-img-bubble { max-width:210px; }
    .ipc-bubble { font-size:14px !important; padding:9px 14px !important; }

    /* Header */
    .ipc-clear-label { display:none; }
    .ipc-badge { max-width:80px; font-size:10px; padding:3px 8px; }
    .ipc-hid  { max-width:90px; }
    .ipc-hactions { gap:5px; }

    /* Reply bar */
    .ipc-reply-bar-text { max-width:180px; }
  }

  /* Extra small phones */
  @media (max-width: 380px) {
    .ipc-msg-in { font-size:16px !important; padding:12px 18px !important; }
    .ipc-bubble { font-size:15px !important; }
  }
`;