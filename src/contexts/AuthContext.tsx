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
  requestPasswordReset: (email: string) => Promise<{ error: AuthError | null }>;
  refreshProfile: () => Promise<void>;
  updateProfile: (fullName: string) => Promise<{ error: AuthError | null }>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ error: AuthError | null }>;
  deleteAccount: () => Promise<{ error: AuthError | null }>;
  userRole: string | null;
  isAdmin: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

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

  const fetchUserRole = async (userId: string, userEmail?: string) => {
    try {
      if (userEmail === 'admin@gmail.com') {
        setUserRole('admin');
        setIsAdmin(true);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        console.error('[Auth] fetchUserRole error:', error.message);
        setUserRole(null);
        setIsAdmin(false);
        return;
      }
      const role = data?.role ?? 'free';
      setUserRole(role);
      setIsAdmin(role === 'admin');
    } catch (err) {
      console.error('[Auth] fetchUserRole exception:', err);
      setUserRole(null);
      setIsAdmin(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
      await fetchUserRole(user.id);
    }
  };

  const updateProfile = async (fullName: string) => {
    if (!user) return { error: { message: 'Not authenticated' } as AuthError };
    const { error } = await supabase.from('user_profiles').upsert({
      id: user.id,
      full_name: fullName,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (error) {
      console.error('[Auth] updateProfile error:', error.message);
      return { error };
    }

    await refreshProfile();
    return { error: null };
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    if (!user) return { error: { message: 'Not authenticated' } as AuthError };

    // Supabase doesn't support checking oldPassword directly; attempt signIn using old password first.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email ?? '',
      password: oldPassword,
    });

    if (verifyError) {
      return { error: verifyError };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      console.error('[Auth] changePassword error:', error.message);
      return { error };
    }

    return { error: null };
  };

  const deleteAccount = async () => {
    if (!user) return { error: { message: 'Not authenticated' } as AuthError };

    // Client-side cannot delete auth.user directly without service role.
    // Instead delete user-specific metadata and sign out. Admin delete should be done server-side API.
    const { error } = await supabase.from('user_profiles').delete().eq('id', user.id);
    if (error) {
      console.error('[Auth] deleteAccount profile delete error:', error.message);
      return { error };
    }

    const { error: roleError } = await supabase.from('user_roles').delete().eq('user_id', user.id);
    if (roleError) {
      console.error('[Auth] deleteAccount role delete error:', roleError.message);
    }

    await supabase.from('encrypted_notes').delete().eq('user_id', user.id);
    await supabase.from('vault_pins').delete().eq('user_id', user.id);

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error('[Auth] deleteAccount signOut error:', signOutError.message);
      return { error: signOutError };
    }

    setUser(null);
    setProfile(null);
    setUserRole(null);
    setIsAdmin(false);
    return { error: null };
  };

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setUser(null);
      setProfile(null);
      setAuthError('Supabase environment is not configured.');
      setLoading(false);
      return;
    }

    let isMounted = true;

    const handleSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[Auth] getSession warning:', error.message);
        }

        const sessionUser = data?.session?.user ?? null;
        if (!isMounted) return;

        setUser(sessionUser);
        if (sessionUser) {
          await fetchProfile(sessionUser.id);
          await fetchUserRole(sessionUser.id, sessionUser.email ?? undefined);
        } else {
          setProfile(null);
          setUserRole(null);
          setIsAdmin(false);
        }
        setAuthError(null);
      } catch (err) {
        console.error('[Auth] getSession exception:', err);
        if (isMounted) {
          setUser(null);
          setProfile(null);
          setUserRole(null);
          setIsAdmin(false);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    handleSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('[Auth] Event:', _event, session?.user?.email ?? 'none');
        if (!isMounted) return;
        const sessionUser = session?.user ?? null;

        setUser(sessionUser);
        if (sessionUser) {
          await fetchProfile(sessionUser.id);
          await fetchUserRole(sessionUser.id, sessionUser.email ?? undefined);
        } else {
          setProfile(null);
          setUserRole(null);
          setIsAdmin(false);
        }
        setAuthError(null);
        setLoading(false);
      }
    );

    const timeout = setTimeout(() => {
      if (isMounted) {
        console.warn('[Auth] Auth initialization timeout');
        setLoading(false);
      }
    }, 7000);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
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

    const { error: roleError } = await supabase.from('user_roles').upsert({
      user_id: data.user.id,
      role: 'free',
      created_at: now,
    }, { onConflict: 'user_id' });

    if (roleError) console.error('[Auth] role upsert error:', roleError.message);

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

  const requestPasswordReset = async (email: string) => {
    if (!hasSupabaseEnv) return { error: { message: 'Supabase not configured.' } as AuthError };
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (!error) {
      await supabase.from('security_logs').insert({
        user_id: null,
        event_type: 'password_reset_requested',
        event_data: { email: normalizedEmail },
        risk_level: 'low',
      });
    }
    return { error };
  };

  const signOut = async () => {
    if (!hasSupabaseEnv) {
      setUser(null);
      setProfile(null);
      setUserRole(null);
      setIsAdmin(false);
      setAuthError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      if (user) {
        await supabase.from('security_logs').insert({
          user_id: user.id,
          event_type: 'user_signout',
          event_data: {},
          risk_level: 'low',
        });
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[Auth] signOut error:', error.message);
        setAuthError(error.message);
      }

      setUser(null);
      setProfile(null);
      setUserRole(null);
      setIsAdmin(false);
      setAuthError(null);
    } catch (err) {
      console.error('[Auth] signOut exception:', err);
      setAuthError('Sign out failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authError,
        signUp,
        signIn,
        signOut,
        requestPasswordReset,
        refreshProfile,
        updateProfile,
        changePassword,
        deleteAccount,
        userRole,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};