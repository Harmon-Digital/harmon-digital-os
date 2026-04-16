import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Loader2, Upload, Camera } from "lucide-react";

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

    const { data } = await supabase
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

    if (!file.type.startsWith('image/')) {
      setMessage({ type: "error", text: "Please select an image file" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Image must be less than 5MB" });
      return;
    }

    setUploadingImage(true);
    setMessage({ type: "", text: "" });

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `profile-${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      setProfileData(prev => ({ ...prev, profile_image_url: publicUrl }));
      setMessage({ type: "success", text: "Image uploaded. Click Save to update your profile." });
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
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({ full_name: profileData.full_name })
        .eq("id", user.id);

      if (profileError) throw profileError;

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

      setMessage({ type: "success", text: "Profile updated successfully." });
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
      setMessage({ type: "success", text: "Password updated successfully." });
    } catch (error) {
      console.error("Error changing password:", error);
      setMessage({ type: "error", text: error.message || "Failed to change password" });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden settings-form">
      <style>{`
        .settings-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
        .settings-form textarea,
        .settings-form [role="combobox"] {
          border-color: transparent !important;
          background-color: transparent !important;
          box-shadow: none !important;
          transition: background-color 0.12s ease, border-color 0.12s ease;
        }
        .settings-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):hover,
        .settings-form textarea:hover,
        .settings-form [role="combobox"]:hover {
          background-color: rgb(249 250 251) !important;
        }
        .settings-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):focus,
        .settings-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):focus-visible,
        .settings-form textarea:focus,
        .settings-form textarea:focus-visible,
        .settings-form [role="combobox"]:focus,
        .settings-form [role="combobox"][data-state="open"] {
          background-color: white !important;
          border-color: rgb(199 210 254) !important;
          box-shadow: 0 0 0 3px rgb(224 231 255 / 0.45) !important;
          outline: none !important;
        }
        .settings-form input:disabled,
        .settings-form textarea:disabled {
          color: rgb(107 114 128) !important;
        }
      `}</style>

      {/* Consolidated toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2 px-4 h-12">
          <h1 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Personal Settings</h1>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 min-h-0">
        <div className="px-4 lg:px-6 py-4 max-w-3xl">
          {message.text && (
            <div className={`mb-4 px-3 py-2 rounded text-[13px] ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}>
              {message.text}
            </div>
          )}

          <Tabs defaultValue="profile" className="space-y-5">
            <TabsList className="h-9 bg-transparent p-0 border-b border-gray-200 dark:border-gray-800 rounded-none w-full justify-start gap-5 px-1">
              <TabsTrigger
                value="profile"
                className="relative h-9 px-0 text-[13px] font-medium text-gray-500 rounded-none bg-transparent shadow-none data-[state=active]:text-gray-900 dark:text-gray-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-transparent data-[state=active]:after:bg-gray-900"
              >
                Profile
              </TabsTrigger>
              <TabsTrigger
                value="notifications"
                className="relative h-9 px-0 text-[13px] font-medium text-gray-500 rounded-none bg-transparent shadow-none data-[state=active]:text-gray-900 dark:text-gray-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-transparent data-[state=active]:after:bg-gray-900"
              >
                Notifications
              </TabsTrigger>
              <TabsTrigger
                value="password"
                className="relative h-9 px-0 text-[13px] font-medium text-gray-500 rounded-none bg-transparent shadow-none data-[state=active]:text-gray-900 dark:text-gray-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-transparent data-[state=active]:after:bg-gray-900"
              >
                Password
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
              <form onSubmit={handleProfileUpdate}>
                {/* Avatar row */}
                <div className="flex items-center gap-4 py-3">
                  <div className="relative">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {profileData.profile_image_url ? (
                        <img
                          src={profileData.profile_image_url}
                          alt={profileData.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl font-semibold text-white">
                          {profileData.full_name?.charAt(0) || 'U'}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="absolute bottom-0 right-0 w-6 h-6 bg-gray-900 hover:bg-gray-800 rounded-full flex items-center justify-center text-white shadow transition-colors"
                    >
                      {uploadingImage ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Camera className="w-3 h-3" />
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
                    <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">Profile photo</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Click the camera icon to upload. Max 5MB.
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="mt-1.5 h-7 px-2 text-[13px]"
                    >
                      {uploadingImage ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 mr-1" />
                          Upload photo
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3 py-2">
                    <label className="text-[12px] text-gray-500 font-medium w-32 shrink-0">Full name</label>
                    <Input
                      value={profileData.full_name}
                      onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                      placeholder="Your full name"
                      className="flex-1 h-8 text-[13px]"
                    />
                  </div>
                  <div className="flex items-center gap-3 py-2">
                    <label className="text-[12px] text-gray-500 font-medium w-32 shrink-0">Email</label>
                    <Input
                      value={userProfile?.email || ""}
                      disabled
                      className="flex-1 h-8 text-[13px]"
                    />
                  </div>
                  <div className="flex items-start gap-3 py-2">
                    <label className="text-[12px] text-gray-500 font-medium w-32 shrink-0 mt-2">Bio</label>
                    <Textarea
                      value={profileData.bio}
                      onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                      placeholder="Tell us a bit about yourself…"
                      rows={4}
                      className="flex-1 text-[13px]"
                    />
                  </div>
                  <div className="flex items-center gap-3 py-2">
                    <label className="text-[12px] text-gray-500 font-medium w-32 shrink-0">Role</label>
                    <Input
                      value={teamMember?.role?.replace(/_/g, ' ') || "N/A"}
                      disabled
                      className="flex-1 h-8 text-[13px] capitalize"
                    />
                  </div>
                  <div className="flex items-center gap-3 py-2">
                    <label className="text-[12px] text-gray-500 font-medium w-32 shrink-0">Account type</label>
                    <Input
                      value={userProfile?.role || "user"}
                      disabled
                      className="flex-1 h-8 text-[13px] capitalize"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={loading}
                    size="sm"
                    className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 mr-1" />
                        Save changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4">
              <div>
                <div className="h-7 flex items-center">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">General</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3 py-2.5">
                    <div className="flex-1">
                      <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">Email notifications</p>
                      <p className="text-[11px] text-gray-500">Master switch for all notification emails</p>
                    </div>
                    <Switch
                      checked={notificationPrefs.email_enabled}
                      onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, email_enabled: checked }))}
                    />
                  </div>
                  <div className="flex items-center gap-3 py-2.5">
                    <div className="flex-1">
                      <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">Daily digest</p>
                      <p className="text-[11px] text-gray-500">Use digest mode for lower-noise notifications</p>
                    </div>
                    <Switch
                      checked={notificationPrefs.daily_digest_enabled}
                      onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, daily_digest_enabled: checked }))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="h-7 flex items-center">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Categories</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
                  {[
                    ["task_enabled", "Tasks"],
                    ["crm_enabled", "CRM"],
                    ["social_kpi_enabled", "Social + KPI"],
                    ["referral_enabled", "Referrals"],
                    ["finance_enabled", "Finance"],
                    ["system_enabled", "System / Integrations"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center gap-3 py-2.5">
                      <p className="flex-1 text-[13px] text-gray-900 dark:text-gray-100">{label}</p>
                      <Switch
                        checked={!!notificationPrefs[key]}
                        onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, [key]: checked }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={saveNotificationPreferences}
                  disabled={savingNotifications}
                  size="sm"
                  className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
                >
                  {savingNotifications ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 mr-1" />
                      Save preferences
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="password" className="space-y-4">
              <form onSubmit={handlePasswordChange}>
                <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3 py-2">
                    <label className="text-[12px] text-gray-500 font-medium w-32 shrink-0">New password</label>
                    <Input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      placeholder="Enter new password"
                      className="flex-1 h-8 text-[13px]"
                    />
                  </div>
                  <div className="flex items-center gap-3 py-2">
                    <label className="text-[12px] text-gray-500 font-medium w-32 shrink-0">Confirm password</label>
                    <Input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                      className="flex-1 h-8 text-[13px]"
                    />
                  </div>
                </div>
                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={passwordLoading}
                    size="sm"
                    className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
                  >
                    {passwordLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update password"
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
