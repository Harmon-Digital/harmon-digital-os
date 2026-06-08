import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const profileRequestId = useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    // Listen for auth changes - this also fires immediately with current session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return;

        setUser(session?.user ?? null);

        if (session?.user) {
          // Fetch profile in background, don't await
          fetchUserProfile(session.user.id);
        } else {
          setUserProfile(null);
          setLoading(false);
        }
      }
    );

    // Fallback timeout to ensure loading eventually stops
    const timeout = setTimeout(() => {
      if (mountedRef.current) {
        setLoading((prev) => (prev ? false : prev));
      }
    }, 3000);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const fetchUserProfile = async (userId) => {
    const requestId = ++profileRequestId.current;
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!mountedRef.current || requestId !== profileRequestId.current) return;

      if (error) {
        if (!error.message?.includes('aborted')) {
          console.error('Error fetching user profile:', error);
        }
        // Transient failure (network, RLS hiccup): keep the previous profile
        // in place rather than blanking the user out and bouncing them to
        // /login. We only clear on explicit signOut.
        return;
      }

      // Success — set the row (or null if the profile row genuinely doesn't
      // exist yet, e.g. a brand-new signup before the trigger has run).
      setUserProfile(data || null);
    } catch (error) {
      if (!mountedRef.current || requestId !== profileRequestId.current) return;
      if (!error.message?.includes('aborted')) {
        console.error('Error fetching user profile:', error);
      }
      // Same as above — don't overwrite the prior profile on transient error.
    } finally {
      if (mountedRef.current && requestId === profileRequestId.current) setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    // Update last_sign_in_at (non-blocking — don't let metadata failure break sign-in).
    // Use upsert in case the trigger that creates user_profiles hasn't run yet
    // (first sign-in after a signup race), so the timestamp isn't silently dropped.
    if (data.user) {
      supabase
        .from('user_profiles')
        .upsert(
          { id: data.user.id, last_sign_in_at: new Date().toISOString() },
          { onConflict: 'id' }
        )
        .then(({ error: updateErr }) => {
          if (updateErr) console.error('Failed to update last_sign_in_at:', updateErr);
        })
        .catch((err) => console.error('Failed to update last_sign_in_at:', err));
    }

    return data;
  };

  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // Clear any portal-preview sessionStorage so the next user on this tab
    // (e.g. a client logging in after a staff preview) doesn't inherit it.
    try {
      sessionStorage.removeItem('hdo.portalPreviewAccount');
    } catch { /* sessionStorage may be unavailable; ignore */ }
    setUser(null);
    setUserProfile(null);
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  };

  const invitePartner = async (email, contactName, companyName) => {
    // Use edge function to create partner with service role key,
    // so the admin's session is never replaced.
    const { data, error } = await supabase.functions.invoke('invite-partner', {
      body: { email, contactName, companyName },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    // Send password reset email so they can set their password
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/partner/login`,
    });

    return data;
  };

  const isAdmin = userProfile?.role === 'admin';
  const isPartner = userProfile?.role === 'partner';

  // Memoize so consumers that read auth context (every protected route, the
  // sidebar, the chat bar) don't re-render on every Provider render — without
  // this, a parent state change would invalidate the value identity each tick
  // and cascade re-renders through the whole tree.
  const value = useMemo(() => ({
    user,
    userProfile,
    loading,
    isAdmin,
    isPartner,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    invitePartner,
    refreshProfile: () => user && fetchUserProfile(user.id),
  }), [user, userProfile, loading, isAdmin, isPartner]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
