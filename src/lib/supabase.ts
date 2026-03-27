import { createClient } from '@supabase/supabase-js';

// ✅ CORRECT PROJECT — zrsesbenelfltrgalvrj
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

export interface UserProfile {
  id: string;
  username: string | null;
  full_name?: string | null;
  created_at: string;
  last_login: string;
  security_score: number;
  total_logins: number;
  failed_login_count: number;
}

export interface SecurityLog {
  id: string;
  user_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface LoginAttempt {
  id: string;
  email: string;
  ip_address: string | null;
  success: boolean;
  attempt_time: string;
  user_agent: string | null;
  blocked: boolean;
}

export interface SecurityScoreHistory {
  id: string;
  user_id: string;
  score: number;
  factors: Record<string, unknown>;
  calculated_at: string;
}

export interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string;
  blocked_at: string;
  blocked_until: string | null;
  auto_blocked: boolean;
}

export interface IPLookupHistory {
  id: string;
  user_id: string;
  ip: string;
  country: string;
  city: string;
  region: string;
  isp: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface ToolUsageHistory {
  id: string;
  user_id: string;
  tool_name: string;
  input_data: string;
  result: string;
  created_at: string;
}

export interface EncryptedNote {
  id: string;
  user_id: string;
  encrypted_content: string;
  iv: string;
  salt: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'free' | 'premium' | 'admin';
  created_at: string;
}

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

export const saveEncryptedNote = async (
  userId: string,
  encryptedContent: string,
  iv: string,
  salt: string
) => {
  const result = await supabase.from('encrypted_notes').insert({
    user_id: userId,
    encrypted_content: encryptedContent,
    iv,
    salt,
  });
  if (result.error) {
    console.error('[Supabase] saveEncryptedNote error:', result.error.message);
  }
  return result;
};

export const fetchEncryptedNotes = async (userId: string) => {
  const result = await supabase.from('encrypted_notes').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (result.error) {
    console.error('[Supabase] fetchEncryptedNotes error:', result.error.message);
  }
  return result;
};

export const deleteEncryptedNote = async (noteId: string) => {
  const result = await supabase.from('encrypted_notes').delete().eq('id', noteId);
  if (result.error) {
    console.error('[Supabase] deleteEncryptedNote error:', result.error.message);
  }
  return result;
};

export const deleteAllUserNotes = async (userId: string) => {
  const result = await supabase.from('encrypted_notes').delete().eq('user_id', userId);
  if (result.error) {
    console.error('[Supabase] deleteAllUserNotes error:', result.error.message);
  }
  return result;
};

// PIN Management
export const savePinHash = async (userId: string, pinHash: string, maxRetries = 3) => {
  let lastError: any = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await supabase.from('vault_pins').upsert(
        { user_id: userId, pin_hash: pinHash, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
      
      if (result.error) {
        lastError = result.error;
        // Check if error is lock-related and retryable
        if (result.error.message && result.error.message.includes('Lock') && attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 100; // exponential backoff: 100ms, 200ms, 400ms
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        console.error('[Supabase] savePinHash error:', result.error.message);
      }
      return result;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return { error: lastError };
};

export const fetchPinHash = async (userId: string) => {
  try {
    const result = await supabase.from('vault_pins').select('pin_hash').eq('user_id', userId).maybeSingle();
    if (result.error) {
      console.error('[Supabase] fetchPinHash error:', result.error.message);
    }
    return result;
  } catch (err) {
    console.error('[Supabase] fetchPinHash exception:', err);
    return { data: null, error: { message: 'Exception fetching PIN hash' } };
  }
};

export const deletePinHash = async (userId: string) => {
  const result = await supabase.from('vault_pins').delete().eq('user_id', userId);
  if (result.error) {
    console.error('[Supabase] deletePinHash error:', result.error.message);
  }
  return result;
};

export const validateCurrentSession = async () => {
  const { data } = await supabase.auth.getSession();
  const sessionUser = data?.session?.user;
  if (!sessionUser) {
    throw new Error('No session available');
  }
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('No session token');
  }
  return { user: sessionUser, token };
};