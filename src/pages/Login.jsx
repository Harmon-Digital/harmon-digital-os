import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [isInvite, setIsInvite] = useState(false);
  const [inviteProcessing, setInviteProcessing] = useState(true);

  const { signIn, resetPassword, updatePassword } = useAuth();
  const navigate = useNavigate();

  // Check if this is an invite/recovery flow
  useEffect(() => {
    const handleInviteFlow = async () => {
      // Check URL hash for tokens (Supabase puts them there)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        // Parse the hash
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (accessToken && (type === 'invite' || type === 'recovery' || type === 'magiclink')) {
          // Set the session
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (!error && data.user) {
            setIsInvite(true);
            setEmail(data.user.email || '');
            // Clear the hash from URL
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
      }
      setInviteProcessing(false);
    };

    handleInviteFlow();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await updatePassword(password);

      // Update last_sign_in_at in user_profiles
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_profiles')
          .update({ last_sign_in_at: new Date().toISOString() })
          .eq('id', user.id);
      }

      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while processing invite token
  if (inviteProcessing) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="w-full px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <img src="/logo.png" alt="Harmon Digital OS" className="w-5 h-5 object-contain" />
          <span className="text-white font-medium text-sm">Harmon Digital OS</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="mb-10">
            <h1 className="text-4xl font-medium text-white mb-3">
              {isInvite ? 'Set your password.' : showReset ? 'Reset your password.' : 'Welcome back.'}
            </h1>
            <p className="text-neutral-500 text-lg">
              {isInvite
                ? 'Create a password to access the Operations Portal.'
                : showReset
                ? 'Enter your email to receive a reset link.'
                : 'Sign in to the Operations Portal.'}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/20 text-red-400">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert for Reset */}
          {resetSent && (
            <Alert className="mb-6 bg-emerald-500/10 border-emerald-500/20">
              <AlertDescription className="text-emerald-400">
                Check your email for a password reset link.
              </AlertDescription>
            </Alert>
          )}

          {/* Form */}
          {!resetSent && (
            <form onSubmit={isInvite ? handleSetPassword : showReset ? handleResetPassword : handleSubmit} className="space-y-6">
              {/* Email field - shown for login and reset, readonly for invite */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-neutral-400 text-sm">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:ring-0"
                  required
                  readOnly={isInvite}
                />
              </div>

              {/* Password field - shown for login and invite */}
              {!showReset && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-neutral-400 text-sm">
                    {isInvite ? 'Create Password' : 'Password'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={isInvite ? 'Create a secure password' : 'Enter your password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:ring-0"
                    required
                  />
                </div>
              )}

              {/* Confirm password - only for invite */}
              {isInvite && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-neutral-400 text-sm">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:ring-0"
                    required
                  />
                </div>
              )}

              <Button
                type="submit"
                className="h-12 w-auto px-8 bg-white text-black hover:bg-neutral-200 font-medium"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isInvite ? 'Set Password & Continue' : showReset ? 'Send Reset Link' : 'Continue'}
              </Button>
            </form>
          )}

          {/* Toggle Reset/Login - hide when in invite mode */}
          {!isInvite && (
            <div className="mt-8">
              <button
                type="button"
                onClick={() => {
                  setShowReset(!showReset);
                  setError('');
                  setResetSent(false);
                }}
                className="text-neutral-500 hover:text-neutral-300 text-sm transition-colors"
              >
                {showReset ? 'Back to sign in' : 'Forgot your password?'}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-8 py-6 border-t border-neutral-900">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Harmon Digital OS" className="w-4 h-4 object-contain" />
            <span className="text-neutral-500 text-sm">Harmon Digital OS</span>
          </div>
          <span className="text-neutral-600 text-sm">info@harmon-digital.com</span>
        </div>
      </footer>
    </div>
  );
}
