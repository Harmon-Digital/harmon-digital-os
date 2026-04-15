import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

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
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!mountedRef.current) return;

      if (error && error.code !== 'PGRST116') {
        // Ignore abort errors
        if (!error.message?.includes('aborted')) {
          console.error('Error fetching user profile:', error);
        }
      }
      setUserProfile(data || null);
    } catch (error) {
      if (!mountedRef.current) return;
      // Ignore abort errors
      if (!error.message?.includes('aborted')) {
        console.error('Error fetching user profile:', error);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    // Update last_sign_in_at (non-blocking — don't let metadata failure break sign-in)
    if (data.user) {
      supabase
        .from('user_profiles')
        .update({ last_sign_in_at: new Date().toISOString() })
        .eq('id', data.user.id)
        .then(({ error: updateErr }) => {
          if (updateErr) console.error('Failed to update last_sign_in_at:', updateErr);
        });
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
    // Use Supabase admin invite (requires service role in edge function)
    // For now, we'll create the user profile and send a password reset
    const { data, error } = await supabase.auth.signUp({
      email,
      password: crypto.randomUUID(), // Random password, they'll reset it
      options: {
        data: {
          full_name: contactName,
        },
      },
    });
    if (error) throw error;

    // Create user profile with partner role
    if (data.user) {
      const { error: profileError } = await supabase.from('user_profiles').upsert({
        id: data.user.id,
        email,
        full_name: contactName,
        role: 'partner',
      });
      if (profileError) throw profileError;

      // Create referral_partners record
      const { error: partnerError } = await supabase.from('referral_partners').insert({
        user_id: data.user.id,
        contact_name: contactName,
        company_name: companyName,
        email,
      });
      if (partnerError) throw partnerError;

      // Send password reset email so they can set their password
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/partner/login`,
      });
    }

    return data;
  };

  const isAdmin = userProfile?.role === 'admin';
  const isPartner = userProfile?.role === 'partner';

  const value = {
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
