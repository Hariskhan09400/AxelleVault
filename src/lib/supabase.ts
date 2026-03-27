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