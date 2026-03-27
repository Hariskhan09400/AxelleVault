import { createContext, useEffect, useState, ReactNode } from 'react';
import { AuthError, User } from '@supabase/supabase-js';
import { hasSupabaseEnv, supabase, UserProfile } from '../lib/supabase';

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  signUp: (email: string, password: string, username: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) { console.error('[Auth] fetchProfile error:', error.message); return; }
      setProfile(data ?? null);
      console.log('[Auth] Profile loaded:', data);
    } catch (err) {
      console.error('[Auth] fetchProfile exception:', err);
    }
  };

  const refreshProfile = async () => { if (user) await fetchProfile(user.id); };

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setUser(null); setProfile(null);
      setAuthError('Supabase environment is not configured.');
      setLoading(false);
      return;
    }

    let isMounted = true;

    // onAuthStateChange fires immediately with current session —
    // removed getSession+timeout which was causing "Auth session timeout" error
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('[Auth] Event:', _event, session?.user?.email ?? 'none');
        if (!isMounted) return;
        const sessionUser = session?.user ?? null;
        setUser(sessionUser);
        if (sessionUser) await fetchProfile(sessionUser.id);
        else setProfile(null);
        setAuthError(null);
        setLoading(false);
      }
    );

    return () => { isMounted = false; subscription.unsubscribe(); };
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    if (!hasSupabaseEnv) return { error: { message: 'Supabase not configured.' } as AuthError };

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date().toISOString();

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { username } },
    });

    if (error) { console.error('[Auth] signUp error:', error.message); return { error }; }
    if (!data.user) return { error: { message: 'Signup failed — no user returned.' } as AuthError };

    console.log('[Auth] New user created:', data.user.id);

    const { error: profileError } = await supabase.from('user_profiles').upsert({
      id: data.user.id,
      username,
      created_at: now,
      last_login: now,
      security_score: 50,
      total_logins: 0,
      failed_login_count: 0,
    });

    if (profileError) console.error('[Auth] Profile upsert error:', profileError.message);
    else console.log('[Auth] Profile created for:', data.user.id);

    await supabase.from('security_logs').insert({
      user_id: data.user.id,
      event_type: 'account_created',
      event_data: { username },
      risk_level: 'low',
    });

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    if (!hasSupabaseEnv) return { error: { message: 'Supabase not configured.' } as AuthError };

    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.user) {
      console.warn('[Auth] signIn failed:', error?.message);
      await supabase.from('login_attempts').insert({
        email: normalizedEmail, success: false,
        attempt_time: new Date().toISOString(),
      });
      return { error };
    }

    const userId = data.user.id;

    const { data: currentProfile } = await supabase
      .from('user_profiles').select('total_logins').eq('id', userId).maybeSingle();

    const { error: updateError } = await supabase.from('user_profiles').upsert({
      id: userId,
      last_login: new Date().toISOString(),
      total_logins: (currentProfile?.total_logins ?? 0) + 1,
      failed_login_count: 0,
    });

    if (updateError) console.error('[Auth] Profile update error:', updateError.message);

    await fetchProfile(userId);

    await supabase.from('login_attempts').insert({
      email: normalizedEmail, success: true,
      attempt_time: new Date().toISOString(),
    });

    await supabase.from('security_logs').insert({
      user_id: userId,
      event_type: 'user_signin',
      event_data: { email: normalizedEmail },
      risk_level: 'low',
    });

    return { error: null };
  };

  const signOut = async () => {
    if (!hasSupabaseEnv) { setUser(null); setProfile(null); return; }
    if (user) {
      await supabase.from('security_logs').insert({
        user_id: user.id, event_type: 'user_signout',
        event_data: {}, risk_level: 'low',
      });
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, authError, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};