import { createContext, useEffect, useState, ReactNode } from 'react';
import { AuthError, User } from '@supabase/supabase-js';
import { hasSupabaseEnv, supabase } from '../lib/supabase';

// ✅ New single table type
export interface UserLoginDetail {
  id: string;
  username: string;
  email: string;
  password_hash: string | null;
  role: 'free' | 'admin';
  security_score: number;
  total_logins: number;
  failed_attempts: number;
  login_history: { time: string; success: boolean; ip?: string }[];
  created_at: string;
  last_login: string | null;
  updated_at: string;
}

export interface AuthContextType {
  user: User | null;
  profile: UserLoginDetail | null;        // ✅ ab profile = user_login_detail row
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
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<UserLoginDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userRole, setUserRole]   = useState<string | null>(null);
  const [isAdmin, setIsAdmin]     = useState(false);

  // ─── Fetch from single table ──────────────────────────────
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_login_detail')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) { console.error('[Auth] fetchProfile error:', error.message); return; }

      setProfile(data ?? null);
      const role = data?.role ?? 'free';
      setUserRole(role);
      setIsAdmin(role === 'admin');
      console.log('[Auth] Profile loaded:', data);
    } catch (err) {
      console.error('[Auth] fetchProfile exception:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  // ─── updateProfile ────────────────────────────────────────
  const updateProfile = async (fullName: string) => {
    if (!user) return { error: { message: 'Not authenticated' } as AuthError };

    const { error } = await supabase
      .from('user_login_detail')
      .update({ username: fullName, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) { console.error('[Auth] updateProfile error:', error.message); return { error }; }
    await refreshProfile();
    return { error: null };
  };

  // ─── changePassword ───────────────────────────────────────
  const changePassword = async (oldPassword: string, newPassword: string) => {
    if (!user) return { error: { message: 'Not authenticated' } as AuthError };

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email ?? '',
      password: oldPassword,
    });
    if (verifyError) return { error: verifyError };

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { console.error('[Auth] changePassword error:', error.message); return { error }; }
    return { error: null };
  };

  // ─── deleteAccount ────────────────────────────────────────
  const deleteAccount = async () => {
    if (!user) return { error: { message: 'Not authenticated' } as AuthError };

    // user_login_detail CASCADE se delete hoga auth.users ke saath
    const { error } = await supabase
      .from('user_login_detail')
      .delete()
      .eq('id', user.id);

    if (error) { console.error('[Auth] deleteAccount error:', error.message); return { error }; }

    // encrypted_notes aur vault_pins bhi clean karo
    await supabase.from('encrypted_notes').delete().eq('user_id', user.id);
    await supabase.from('vault_pins').delete().eq('user_id', user.id);

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) return { error: signOutError };

    setUser(null);
    setProfile(null);
    setUserRole(null);
    setIsAdmin(false);
    return { error: null };
  };

  // ─── Session init ─────────────────────────────────────────
  useEffect(() => {
    if (!hasSupabaseEnv) {
      setAuthError('Supabase environment is not configured.');
      setLoading(false);
      return;
    }

    let isMounted = true;

    const handleSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.warn('[Auth] getSession warning:', error.message);

        const sessionUser = data?.session?.user ?? null;
        if (!isMounted) return;

        setUser(sessionUser);
        if (sessionUser) await fetchProfile(sessionUser.id);
        else { setProfile(null); setUserRole(null); setIsAdmin(false); }
        setAuthError(null);
      } catch (err) {
        console.error('[Auth] getSession exception:', err);
        if (isMounted) { setUser(null); setProfile(null); setUserRole(null); setIsAdmin(false); }
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
        if (sessionUser) await fetchProfile(sessionUser.id);
        else { setProfile(null); setUserRole(null); setIsAdmin(false); }
        setAuthError(null);
        setLoading(false);
      }
    );

    const timeout = setTimeout(() => {
      if (isMounted) { console.warn('[Auth] Timeout'); setLoading(false); }
    }, 7000);

    return () => { isMounted = false; clearTimeout(timeout); subscription.unsubscribe(); };
  }, []);

  // ─── signUp ───────────────────────────────────────────────
  const signUp = async (email: string, password: string, username: string) => {
    if (!hasSupabaseEnv) return { error: { message: 'Supabase not configured.' } as AuthError };

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date().toISOString();

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { username } },
      // ✅ emailRedirectTo nahi diya — dashboard pe "Confirm email" OFF karo
    });

    if (error) { console.error('[Auth] signUp error:', error.message); return { error }; }
    if (!data.user) return { error: { message: 'Signup failed — no user returned.' } as AuthError };

    // ✅ Sab kuch ek hi table mein insert
    const { error: insertError } = await supabase.from('user_login_detail').upsert({
      id:             data.user.id,
      username,
      email:          normalizedEmail,
      password_hash:  null,           // Supabase auth internally handle karta hai
      role:           'free',
      security_score: 50,
      total_logins:   0,
      failed_attempts: 0,
      login_history:  [],
      created_at:     now,
      last_login:     now,
    });

    if (insertError) console.error('[Auth] user_login_detail insert error:', insertError.message);
    else console.log('[Auth] user_login_detail created for:', data.user.id);

    return { error: null };
  };

  // ─── signIn ───────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    if (!hasSupabaseEnv) return { error: { message: 'Supabase not configured.' } as AuthError };

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date().toISOString();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.user) {
      console.warn('[Auth] signIn failed:', error?.message);

      // ✅ Failed attempt — login_history mein push karo
      const { data: existing } = await supabase
        .from('user_login_detail')
        .select('login_history, failed_attempts')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existing) {
        const history = [...(existing.login_history ?? []), { time: now, success: false }].slice(-10);
        await supabase.from('user_login_detail').update({
          failed_attempts: (existing.failed_attempts ?? 0) + 1,
          login_history: history,
        }).eq('email', normalizedEmail);
      }

      return { error };
    }

    const userId = data.user.id;

    // ✅ Successful login — sab ek hi update mein
    const { data: current } = await supabase
      .from('user_login_detail')
      .select('total_logins, login_history')
      .eq('id', userId)
      .maybeSingle();

    const history = [...(current?.login_history ?? []), { time: now, success: true }].slice(-10);

    await supabase.from('user_login_detail').update({
      last_login:      now,
      total_logins:    (current?.total_logins ?? 0) + 1,
      failed_attempts: 0,
      login_history:   history,
    }).eq('id', userId);

    await fetchProfile(userId);
    return { error: null };
  };

  // ─── requestPasswordReset ─────────────────────────────────
  // ✅ Sirf yahan email jayegi — reset ke liye intentional
  const requestPasswordReset = async (email: string) => {
    if (!hasSupabaseEnv) return { error: { message: 'Supabase not configured.' } as AuthError };
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/reset-password` }
    );
    return { error };
  };

  // ─── signOut ──────────────────────────────────────────────
  const signOut = async () => {
    if (!hasSupabaseEnv) {
      setUser(null); setProfile(null); setUserRole(null);
      setIsAdmin(false); setAuthError(null); setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) { console.error('[Auth] signOut error:', error.message); setAuthError(error.message); }
      setUser(null); setProfile(null); setUserRole(null); setIsAdmin(false); setAuthError(null);
    } catch (err) {
      console.error('[Auth] signOut exception:', err);
      setAuthError('Sign out failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, profile, loading, authError,
      signUp, signIn, signOut,
      requestPasswordReset, refreshProfile,
      updateProfile, changePassword, deleteAccount,
      userRole, isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};