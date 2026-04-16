import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";

export default function ClientSettings() {
  const { user, userProfile } = useAuth();
  const [fullName, setFullName] = useState(userProfile?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    setFullName(userProfile?.full_name || "");
  }, [userProfile]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ full_name: fullName })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated");
    } catch (err) {
      toast.error("Couldn't update", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 8) return toast.error("Password must be at least 8 characters");
    if (newPassword !== confirmPassword) return toast.error("Passwords don't match");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (err) {
      toast.error("Couldn't update password", { description: err.message });
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      <h1 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100">Settings</h1>

      {/* Profile */}
      <section>
        <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Profile</div>
        <div className="space-y-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-4">
          <div>
            <Label className="text-[12px] text-gray-600 dark:text-gray-400">Full name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 h-8 text-[13px]"
            />
          </div>
          <div>
            <Label className="text-[12px] text-gray-600 dark:text-gray-400">Email</Label>
            <Input
              value={user?.email || ""}
              disabled
              className="mt-1 h-8 text-[13px] bg-gray-50 dark:bg-gray-800"
            />
            <p className="text-[11px] text-gray-400 mt-1">Contact your account manager to change email.</p>
          </div>
          <Button
            onClick={saveProfile}
            disabled={saving}
            size="sm"
            className="h-8 bg-gray-900 hover:bg-gray-800 text-white text-[13px]"
          >
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </section>

      {/* Password */}
      <section>
        <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Password</div>
        <div className="space-y-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-4">
          <div>
            <Label className="text-[12px] text-gray-600 dark:text-gray-400">New password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 h-8 text-[13px]"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label className="text-[12px] text-gray-600 dark:text-gray-400">Confirm password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 h-8 text-[13px]"
              autoComplete="new-password"
            />
          </div>
          <Button
            onClick={changePassword}
            disabled={!newPassword || !confirmPassword}
            size="sm"
            variant="outline"
            className="h-8 text-[13px]"
          >
            Update password
          </Button>
        </div>
      </section>
    </div>
  );
}
