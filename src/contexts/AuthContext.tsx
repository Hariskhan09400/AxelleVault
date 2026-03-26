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

      if (error) {
        console.error('[Auth] Error fetching profile:', error);
        return;
      }

      setProfile(data ?? null);
      console.log('[Auth] Profile loaded:', data);
    } catch (error) {
      console.error('[Auth] Profile fetch exception:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const timeoutMs = 7000;

    const init = async () => {
      if (!hasSupabaseEnv) {
        console.warn('[Auth] Supabase env missing. Skipping remote session initialization.');
        if (isMounted) {
          setUser(null);
          setProfile(null);
          setAuthError('Supabase environment is not configured.');
          setLoading(false);
        }
        return;
      }

      try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Auth session timeout')), timeoutMs)
          ),
        ]);

        if (!isMounted) return;

        const sessionUser = sessionResult.data.session?.user ?? null;
        console.log('[Auth] Initial session:', sessionUser ? sessionUser.email : 'none');

        setUser(sessionUser);
        if (sessionUser) {
          await fetchProfile(sessionUser.id);
        } else {
          setProfile(null);
        }
        setAuthError(null);
      } catch (error) {
        console.error('[Auth] Session init failed:', error);
        if (isMounted) {
          setUser(null);
          setProfile(null);
          setAuthError('Failed to initialize authentication session.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[Auth] State changed:', _event, session?.user?.email ?? 'none');
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setAuthError(null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    if (!hasSupabaseEnv) {
      return { error: { message: 'Supabase environment is not configured.' } as AuthError };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date().toISOString();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          username,
        },
      },
    });

    if (error || !data.user) {
      return { error };
    }

    const { error: profileError } = await supabase.from('user_profiles').upsert({
      id: data.user.id,
      username,
      created_at: now,
      last_login: now,
      security_score: 50,
      total_logins: 0,
      failed_login_count: 0,
    });

    if (profileError) {
      console.error('Profile creation error:', profileError);
    }

    await supabase.from('security_logs').insert({
      user_id: data.user.id,
      event_type: 'account_created',
      event_data: { username },
      risk_level: 'low',
    });

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    if (!hasSupabaseEnv) {
      return { error: { message: 'Supabase environment is not configured.' } as AuthError };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.user) {
      await supabase.from('login_attempts').insert({
        email: normalizedEmail,
        success: false,
        attempt_time: new Date().toISOString(),
      });
      return { error };
    }

    const { data: currentProfile } = await supabase
      .from('user_profiles')
      .select('total_logins')
      .eq('id', data.user.id)
      .maybeSingle();

    await supabase
      .from('user_profiles')
      .update({
        last_login: new Date().toISOString(),
        total_logins: (currentProfile?.total_logins ?? 0) + 1,
      })
      .eq('id', data.user.id);

    await supabase.from('login_attempts').insert({
      email: normalizedEmail,
      success: true,
      attempt_time: new Date().toISOString(),
    });

    await supabase.from('security_logs').insert({
      user_id: data.user.id,
      event_type: 'user_signin',
      event_data: { email: normalizedEmail },
      risk_level: 'low',
    });

    return { error: null };
  };

  const signOut = async () => {
    if (!hasSupabaseEnv) {
      setUser(null);
      setProfile(null);
      return;
    }

    if (user) {
      await supabase.from('security_logs').insert({
        user_id: user.id,
        event_type: 'user_signout',
        event_data: {},
        risk_level: 'low',
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
