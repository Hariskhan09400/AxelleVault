import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zrsesbenelfltrgalvrj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpyc2VzYmVuZWxmbHRyZ2FsdnJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NTM1ODcsImV4cCI6MjA5MDEyOTU4N30.J9gt7grtq0Lsnou3tdLjetv7RpO3bjUgwPtjfda7lQk';

export const hasSupabaseEnv = true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// ─── Session ───────────────────────────────────────────────
export const validateCurrentSession = async () => {
  const { data } = await supabase.auth.getSession();
  const sessionUser = data?.session?.user;
  if (!sessionUser) throw new Error('No session available');
  const token = data.session?.access_token;
  if (!token) throw new Error('No session token');
  return { user: sessionUser, token };
};

// ─── Tool Usage ────────────────────────────────────────────
export const logToolUsage = async (
  userId: string,
  toolName: string,
  inputData: string,
  result: string
) => {
  if (!userId) return;
  await supabase.from('tool_usage_history').insert({
    user_id: userId,
    tool_name: toolName,
    input_data: inputData,
    result,
  });
};

// ─── Notes ─────────────────────────────────────────────────
export const saveEncryptedNote = async (
  userId: string,
  content: string,
  iv: string,
  salt: string
) => {
  const result = await supabase
    .from('notesvault')
    .insert({ user_id: userId, type: 'note', content, iv, salt });
  if (result.error) console.error('[Supabase] saveEncryptedNote error:', result.error.message);
  return result;
};

export const fetchEncryptedNotes = async (userId: string) => {
  const result = await supabase
    .from('notesvault')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'note')
    .order('created_at', { ascending: false });
  if (result.error) console.error('[Supabase] fetchEncryptedNotes error:', result.error.message);
  return result;
};

export const deleteEncryptedNote = async (noteId: string) => {
  const result = await supabase.from('notesvault').delete().eq('id', noteId);
  if (result.error) console.error('[Supabase] deleteEncryptedNote error:', result.error.message);
  return result;
};

export const deleteAllUserNotes = async (userId: string) => {
  const result = await supabase
    .from('notesvault')
    .delete()
    .eq('user_id', userId)
    .eq('type', 'note');
  if (result.error) console.error('[Supabase] deleteAllUserNotes error:', result.error.message);
  return result;
};

// ─── PIN ───────────────────────────────────────────────────
export const savePinHash = async (userId: string, pinHash: string, maxRetries = 3) => {
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data: existing } = await supabase
        .from('notesvault')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'pin')
        .maybeSingle();

      let result;
      if (existing?.id) {
        result = await supabase
          .from('notesvault')
          .update({ pin_hash: pinHash })
          .eq('id', existing.id);
      } else {
        result = await supabase
          .from('notesvault')
          .insert({ user_id: userId, type: 'pin', pin_hash: pinHash });
      }

      if (result.error) {
        lastError = result.error;
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 100));
          continue;
        }
        console.error('[Supabase] savePinHash error:', result.error.message);
      }
      return result;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 100));
      }
    }
  }
  return { error: lastError };
};

export const fetchPinHash = async (userId: string) => {
  try {
    const result = await supabase
      .from('notesvault')
      .select('id, pin_hash')
      .eq('user_id', userId)
      .eq('type', 'pin')
      .maybeSingle();
    if (result.error) console.error('[Supabase] fetchPinHash error:', result.error.message);
    return result;
  } catch (err) {
    console.error('[Supabase] fetchPinHash exception:', err);
    return { data: null, error: { message: 'Exception fetching PIN hash' } };
  }
};

export const deletePinHash = async (userId: string) => {
  const result = await supabase
    .from('notesvault')
    .delete()
    .eq('user_id', userId)
    .eq('type', 'pin');
  if (result.error) console.error('[Supabase] deletePinHash error:', result.error.message);
  return result;
};

// ─── Interfaces ────────────────────────────────────────────
export interface UserLoginDetail {
  id: string;
  username: string | null;
  email: string;
  password_hash: string | null;
  role: string;
  security_score: number;
  total_logins: number;
  failed_attempts: number;
  login_history: Array<{ time: string; success: boolean }>;
  last_login: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface EncryptedNote {
  id: string;
  user_id: string;
  type: 'note' | 'pin';
  content: string;
  iv: string;
  salt: string;
  created_at: string;
}