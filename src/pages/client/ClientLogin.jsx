import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

/**
 * ClientLogin — sign-in for invited clients.
 *
 * Clients are INVITE-ONLY — there's no signup form here. An admin sends
 * an invite from the internal Contacts page, the client receives a magic
 * link + sets a password, then comes back here to sign in.
 */
export default function ClientLogin() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [mode, setMode] = useState("login"); // login | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signIn(email, password);

      // Verify role
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("email", email)
        .maybeSingle();

      if (profile?.role !== "client") {
        await supabase.auth.signOut();
        setError("This portal is for clients. Please use your normal login if you're on the team.");
        setLoading(false);
        return;
      }

      // Update last login timestamp on contact
      await supabase
        .from("contacts")
        .update({ portal_last_login_at: new Date().toISOString() })
        .eq("portal_user_id", (await supabase.auth.getUser()).data?.user?.id);

      navigate("/client");
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/client/login`,
      });
      if (err) throw err;
      setSuccess("Check your email for a reset link.");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo + title */}
        <div className="text-center mb-6">
          <img src="/logo.png" alt="" className="w-9 h-9 mx-auto mb-4 rounded" />
          <h1 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100">
            {mode === "reset" ? "Reset password" : "Client Portal"}
          </h1>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
            {mode === "reset"
              ? "Enter your email to receive a reset link."
              : "Sign in to view your projects, invoices, and approvals."}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5 shadow-sm">
          {error && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription className="text-[13px]">{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-3 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300">
              <AlertDescription className="text-[13px]">{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={mode === "reset" ? handleReset : handleLogin} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-[12px] text-gray-600 dark:text-gray-400">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
                className="h-9 text-[13px]"
              />
            </div>

            {mode === "login" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-[12px] text-gray-600 dark:text-gray-400">Password</Label>
                  <button
                    type="button"
                    onClick={() => { setMode("reset"); setError(""); setSuccess(""); }}
                    className="text-[11px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    Forgot?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-9 text-[13px]"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-9 text-[13px] bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:hover:bg-white dark:text-gray-900"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {mode === "reset" ? "Send reset link" : "Sign in"}
            </Button>

            {mode === "reset" && (
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                className="block w-full text-center text-[12px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Back to sign in
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 mt-4">
          Don't have access yet? Your account manager will send an invite.
        </p>
      </div>
    </div>
  );
}
