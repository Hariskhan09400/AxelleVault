import { createContext, useEffect, useState, ReactNode, useRef } from 'react';
import { AuthError, User } from '@supabase/supabase-js';
import { hasSupabaseEnv, supabase } from '../lib/supabase';

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

export interface AuthContextType {
  user: User | null;
  profile: UserLoginDetail | null;
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
  const [user, setUser]         = useState<User | null>(null);
  const [profile, setProfile]   = useState<UserLoginDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAdmin, setIsAdmin]   = useState(false);

  // ✅ KEY FIX: signup flow mein auto-login block karne ke liye flag
  const isSigningUp = useRef(false);

  // ─── fetchProfile ─────────────────────────────────────────
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
    } catch (err) {
      console.error('[Auth] fetchProfile exception:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  // ─── clearAllState ────────────────────────────────────────
  const clearAllState = () => {
    setUser(null);
    setProfile(null);
    setUserRole(null);
    setIsAdmin(false);
    setAuthError(null);
  };

  // ─── clearAllStorage ──────────────────────────────────────
  const clearAllStorage = () => {
    Object.keys(localStorage).forEach(key => {
      if (
        key.includes('supabase') ||
        key.includes('sb-') ||
        key.includes('axellevault') ||
        key.startsWith('av_')
      ) {
        localStorage.removeItem(key);
      }
    });
    sessionStorage.clear();
  };

  // ─── Session init ─────────────────────────────────────────
  useEffect(() => {
    if (!hasSupabaseEnv) {
      setAuthError('Supabase not configured.');
      setLoading(false);
      return;
    }

    let isMounted = true;

    // App open hone pe existing session check karo
    const initSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data?.session?.user ?? null;
        if (!isMounted) return;

        // ✅ Sirf tab set karo jab SIGN IN hua ho, signup nahi
        if (sessionUser && !isSigningUp.current) {
          setUser(sessionUser);
          await fetchProfile(sessionUser.id);
        } else {
          clearAllState();
        }
      } catch (err) {
        console.error('[Auth] initSession error:', err);
        if (isMounted) clearAllState();
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initSession();

    // Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] Event:', event, '| User:', session?.user?.email ?? 'none');
        if (!isMounted) return;

        if (event === 'SIGNED_OUT') {
          clearAllState();
          setLoading(false);
          return;
        }

        // ✅ SIGNUP event pe auto-login block karo
        if (event === 'SIGNED_IN' && isSigningUp.current) {
          console.log('[Auth] Signup flow — blocking auto-login, signing out silently');
          isSigningUp.current = false;
          // Silent signout — state change nahi hogi
          await supabase.auth.signOut({ scope: 'global' });
          clearAllStorage();
          clearAllState();
          setLoading(false);
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }

        setLoading(false);
      }
    );

    const timeout = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 6000);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // ─── signUp ───────────────────────────────────────────────
  const signUp = async (email: string, password: string, username: string) => {
    if (!hasSupabaseEnv) return { error: { message: 'Supabase not configured.' } as AuthError };

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date().toISOString();

    // ✅ Flag set karo — auto-login block hoga
    isSigningUp.current = true;

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { username } },
    });

    if (error) {
      isSigningUp.current = false;
      console.error('[Auth] signUp error:', error.message);
      return { error };
    }

    if (!data.user) {
      isSigningUp.current = false;
      return { error: { message: 'Signup failed — no user returned.' } as AuthError };
    }

    // user_login_detail mein insert — trigger bhi handle karta hai
    const { error: insertError } = await supabase
      .from('user_login_detail')
      .insert({
        id:             data.user.id,
        username,
        email:          normalizedEmail,
        password_hash:  null,
        role:           'free',
        security_score: 50,
        total_logins:   0,
        failed_attempts: 0,
        login_history:  [],
        created_at:     now,
        last_login:     now,
      });

    if (insertError) {
      console.warn('[Auth] insert warning (trigger may handle):', insertError.message);
    }

    // ✅ Signup ke baad silently sign out — user ko manually login karna padega
    await supabase.auth.signOut({ scope: 'global' });
    clearAllStorage();
    clearAllState();
    isSigningUp.current = false;

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

      // Failed attempt log
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

      return { error: error ?? { message: 'Login failed' } as AuthError };
    }

    const userId = data.user.id;

    // Successful login update
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

    // ✅ State set karo
    setUser(data.user);
    await fetchProfile(userId);

    return { error: null };
  };

  // ─── signOut ──────────────────────────────────────────────
  const signOut = async () => {
    try {
      setLoading(true);

      // ✅ Pehle Supabase session kill karo
      if (hasSupabaseEnv) {
        await supabase.auth.signOut({ scope: 'global' });
      }

      // Phir state aur storage clear karo
      clearAllState();
      clearAllStorage();

    } catch (err) {
      console.error('[Auth] signOut exception:', err);
      clearAllState();
      clearAllStorage();
    } finally {
      setLoading(false);
    }
  };

  // ─── updateProfile ────────────────────────────────────────
  const updateProfile = async (fullName: string) => {
    if (!user) return { error: { message: 'Not authenticated' } as AuthError };
    const { error } = await supabase
      .from('user_login_detail')
      .update({ username: fullName, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return { error };
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
    return { error: error ?? null };
  };

  // ─── deleteAccount ────────────────────────────────────────
  const deleteAccount = async () => {
    if (!user) return { error: { message: 'Not authenticated' } as AuthError };
    const { error } = await supabase
      .from('user_login_detail')
      .delete()
      .eq('id', user.id);
    if (error) return { error };
    await supabase.auth.signOut();
    clearAllState();
    clearAllStorage();
    return { error: null };
  };

  // ─── requestPasswordReset ─────────────────────────────────
  const requestPasswordReset = async (email: string) => {
    if (!hasSupabaseEnv) return { error: { message: 'Supabase not configured.' } as AuthError };
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/reset-password` }
    );
    return { error };
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