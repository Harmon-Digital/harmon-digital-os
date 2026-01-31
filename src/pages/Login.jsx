import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();

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
              {showReset ? 'Reset your password.' : 'Welcome back.'}
            </h1>
            <p className="text-neutral-500 text-lg">
              {showReset
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
            <form onSubmit={showReset ? handleResetPassword : handleSubmit} className="space-y-6">
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
                />
              </div>

              {!showReset && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-neutral-400 text-sm">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                {showReset ? 'Send Reset Link' : 'Continue'}
              </Button>
            </form>
          )}

          {/* Toggle Reset/Login */}
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
