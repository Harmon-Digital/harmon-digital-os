import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Lock, Save, Loader2, Upload, Camera, Bell } from "lucide-react";

export default function PersonalSettings() {
  const { user, userProfile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [teamMember, setTeamMember] = useState(null);
  const fileInputRef = useRef(null);

  const [profileData, setProfileData] = useState({
    full_name: "",
    bio: "",
    profile_image_url: ""
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: ""
  });

  const [notificationPrefs, setNotificationPrefs] = useState({
    email_enabled: true,
    social_kpi_enabled: true,
    task_enabled: true,
    crm_enabled: true,
    referral_enabled: true,
    finance_enabled: true,
    system_enabled: true,
    daily_digest_enabled: false,
  });
  const [savingNotifications, setSavingNotifications] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setProfileData(prev => ({
        ...prev,
        full_name: userProfile.full_name || ""
      }));
      loadTeamMember();
      loadNotificationPreferences();
    }
  }, [userProfile]);

  const loadTeamMember = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setTeamMember(data);
      setProfileData(prev => ({
        ...prev,
        full_name: data.full_name || prev.full_name,
        bio: data.bio || "",
        profile_image_url: data.profile_image_url || ""
      }));
    }
  };

  const loadNotificationPreferences = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error loading notification preferences:", error);
      return;
    }

    if (data) {
      setNotificationPrefs(prev => ({ ...prev, ...data }));
    }
  };

  const saveNotificationPreferences = async () => {
    if (!user?.id) return;
    setSavingNotifications(true);
    setMessage({ type: "", text: "" });

    try {
      const payload = {
        user_id: user.id,
        ...notificationPrefs,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("notification_preferences")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;
      setMessage({ type: "success", text: "Notification preferences updated." });
    } catch (error) {
      console.error("Error saving notification preferences:", error);
      setMessage({ type: "error", text: error.message || "Failed to save notification preferences" });
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: "error", text: "Please select an image file" });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Image must be less than 5MB" });
      return;
    }

    setUploadingImage(true);
    setMessage({ type: "", text: "" });

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `profile-${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      // Update state
      setProfileData(prev => ({ ...prev, profile_image_url: publicUrl }));
      setMessage({ type: "success", text: "Image uploaded! Click Save to update your profile." });
    } catch (error) {
      console.error("Error uploading image:", error);
      setMessage({ type: "error", text: error.message || "Failed to upload image" });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      // Update user_profiles table
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({ full_name: profileData.full_name })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update team_members if linked
      if (teamMember) {
        const { error: teamError } = await supabase
          .from("team_members")
          .update({
            full_name: profileData.full_name,
            bio: profileData.bio || null,
            profile_image_url: profileData.profile_image_url || null
          })
          .eq("user_id", user.id);

        if (teamError) throw teamError;
      }

      if (refreshProfile) {
        await refreshProfile();
      }

      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({ type: "error", text: error.message || "Failed to update profile" });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setMessage({ type: "", text: "" });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      setPasswordLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" });
      setPasswordLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      setPasswordData({ newPassword: "", confirmPassword: "" });
      setMessage({ type: "success", text: "Password updated successfully!" });
    } catch (error) {
      console.error("Error changing password:", error);
      setMessage({ type: "error", text: error.message || "Failed to change password" });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Personal Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account settings and profile</p>
      </div>

      {message.text && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === "success"
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your personal information displayed to the team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              {/* Profile Image Upload */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {profileData.profile_image_url ? (
                      <img
                        src={profileData.profile_image_url}
                        alt={profileData.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-bold text-white">
                        {profileData.full_name?.charAt(0) || 'U'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 hover:bg-indigo-700 rounded-full flex items-center justify-center text-white shadow-lg transition-colors"
                  >
                    {uploadingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">Profile Photo</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Click the camera icon to upload a new photo. Max size: 5MB
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="mt-2"
                  >
                    {uploadingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Photo
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                  placeholder="Your full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={userProfile?.email || ""}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                  placeholder="Tell us a bit about yourself..."
                  rows={4}
                />
                <p className="text-xs text-gray-500">This will be displayed on your team profile</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input
                    value={teamMember?.role?.replace('_', ' ') || "N/A"}
                    disabled
                    className="bg-gray-50 capitalize"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Input
                    value={userProfile?.role || "user"}
                    disabled
                    className="bg-gray-50 capitalize"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Control which events notify you in-app and by email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">Email notifications</p>
                <p className="text-xs text-gray-500">Master switch for all notification emails</p>
              </div>
              <Switch
                checked={notificationPrefs.email_enabled}
                onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, email_enabled: checked }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ["task_enabled", "Tasks"],
                ["crm_enabled", "CRM"],
                ["social_kpi_enabled", "Social + KPI"],
                ["referral_enabled", "Referrals"],
                ["finance_enabled", "Finance"],
                ["system_enabled", "System / Integrations"],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                  <p className="text-sm font-medium">{label}</p>
                  <Switch
                    checked={!!notificationPrefs[key]}
                    onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, [key]: checked }))}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">Daily digest (non-urgent)</p>
                <p className="text-xs text-gray-500">Use digest mode for lower-noise notifications</p>
              </div>
              <Switch
                checked={notificationPrefs.daily_digest_enabled}
                onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, daily_digest_enabled: checked }))}
              />
            </div>

            <Button onClick={saveNotificationPreferences} disabled={savingNotifications} className="bg-indigo-600 hover:bg-indigo-700">
              {savingNotifications ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Notification Preferences
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>

              <Button type="submit" disabled={passwordLoading} variant="outline">
                {passwordLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Update Password
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
