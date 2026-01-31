import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function PartnerLogin() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [mode, setMode] = useState("login"); // login, signup, reset, confirm
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [signupEmail, setSignupEmail] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signIn(email, password);

      // Check if user is a partner
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("email", email)
        .single();

      if (profile?.role !== "partner") {
        await supabase.auth.signOut();
        setError("This portal is for partners only. Please use the main login.");
        setLoading(false);
        return;
      }

      navigate("/partner");
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      // Create user account
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: contactName,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        // Create user profile with partner role
        await supabase.from("user_profiles").upsert({
          id: data.user.id,
          email,
          full_name: contactName,
          role: "partner",
        });

        // Create referral_partners record
        await supabase.from("referral_partners").insert({
          user_id: data.user.id,
          contact_name: contactName,
          company_name: companyName,
          email,
        });

        // Check if user is already confirmed (auto-confirm disabled) or session exists
        if (data.session) {
          // Auto-signed in, redirect to dashboard
          navigate("/partner");
        } else {
          // Email confirmation required - show confirmation screen
          setSignupEmail(email);
          setMode("confirm");
          setPassword("");
          setConfirmPassword("");
        }
      }
    } catch (err) {
      setError(err.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/partner/login`,
      });
      if (error) throw error;
      setSuccess("Check your email for a password reset link.");
    } catch (err) {
      setError(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  const getHeading = () => {
    switch (mode) {
      case "signup":
        return { title: "Become a partner.", subtitle: "Create your partner account to start earning commissions." };
      case "reset":
        return { title: "Reset your password.", subtitle: "Enter your email to receive a reset link." };
      case "confirm":
        return { title: "Check your email.", subtitle: "We sent a confirmation link to complete your signup." };
      default:
        return { title: "Welcome back.", subtitle: "Sign in to the Partner Portal." };
    }
  };

  const heading = getHeading();

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="w-full px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <img src="/logo.png" alt="Harmon Digital" className="w-5 h-5 object-contain" />
          <span className="text-white font-medium text-sm">Harmon Digital</span>
          <span className="text-neutral-600 text-sm ml-1">Partner Portal</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="mb-10">
            <h1 className="text-4xl font-medium text-white mb-3">{heading.title}</h1>
            <p className="text-neutral-500 text-lg">{heading.subtitle}</p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/20 text-red-400">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {success && (
            <Alert className="mb-6 bg-emerald-500/10 border-emerald-500/20">
              <AlertDescription className="text-emerald-400">{success}</AlertDescription>
            </Alert>
          )}

          {/* Login Form */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-6">
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

              <Button
                type="submit"
                className="h-12 w-auto px-8 bg-white text-black hover:bg-neutral-200 font-medium"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
              </Button>
            </form>
          )}

          {/* Signup Form */}
          {mode === "signup" && (
            <form onSubmit={handleSignup} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName" className="text-neutral-400 text-sm">
                    Your Name
                  </Label>
                  <Input
                    id="contactName"
                    type="text"
                    placeholder="John Smith"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="h-12 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:ring-0"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-neutral-400 text-sm">
                    Company
                  </Label>
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Company LLC"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="h-12 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:ring-0"
                  />
                </div>
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="password" className="text-neutral-400 text-sm">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:ring-0"
                  required
                />
              </div>

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

              <Button
                type="submit"
                className="h-12 w-auto px-8 bg-white text-black hover:bg-neutral-200 font-medium"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </form>
          )}

          {/* Reset Form */}
          {mode === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-6">
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

              <Button
                type="submit"
                className="h-12 w-auto px-8 bg-white text-black hover:bg-neutral-200 font-medium"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
            </form>
          )}

          {/* Email Confirmation Screen */}
          {mode === "confirm" && (
            <div className="space-y-6">
              <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-lg">
                <div className="flex items-center justify-center w-12 h-12 bg-emerald-500/10 rounded-full mb-4 mx-auto">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-neutral-300 text-center mb-2">
                  We sent a confirmation email to:
                </p>
                <p className="text-white font-medium text-center mb-4">
                  {signupEmail}
                </p>
                <p className="text-neutral-500 text-sm text-center">
                  Click the link in the email to activate your account, then come back here to sign in.
                </p>
              </div>

              <Button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className="h-12 w-auto px-8 bg-white text-black hover:bg-neutral-200 font-medium"
              >
                Back to Sign In
              </Button>
            </div>
          )}

          {/* Mode Toggle Links */}
          {mode !== "confirm" && (
            <div className="mt-8 space-y-3">
              {mode === "login" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setError("");
                      setSuccess("");
                    }}
                    className="block text-neutral-400 hover:text-white text-sm transition-colors"
                  >
                    Don't have an account? <span className="text-white">Sign up</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("reset");
                      setError("");
                      setSuccess("");
                    }}
                    className="block text-neutral-500 hover:text-neutral-300 text-sm transition-colors"
                  >
                    Forgot your password?
                  </button>
                </>
              )}
              {mode === "signup" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setSuccess("");
                  }}
                  className="block text-neutral-400 hover:text-white text-sm transition-colors"
                >
                  Already have an account? <span className="text-white">Sign in</span>
                </button>
              )}
              {mode === "reset" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setSuccess("");
                  }}
                  className="block text-neutral-500 hover:text-neutral-300 text-sm transition-colors"
                >
                  Back to sign in
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-8 py-6 border-t border-neutral-900">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Harmon Digital" className="w-4 h-4 object-contain" />
            <span className="text-neutral-500 text-sm">Harmon Digital Partner Portal</span>
          </div>
          <span className="text-neutral-600 text-sm">info@harmon-digital.com</span>
        </div>
      </footer>
    </div>
  );
}
