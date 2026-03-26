import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key'
);

export interface UserProfile {
  id: string;
  username: string | null;
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
