import React, { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Check } from "lucide-react";

export default function PartnerSettings() {
  const { user, updatePassword } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [partner, setPartner] = useState(null);
  const [formData, setFormData] = useState({
    contact_name: "",
    company_name: "",
    email: "",
    phone: "",
    payment_method: "bank_transfer",
    payment_details: "",
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("referral_partners")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setPartner(data);
        setFormData({
          contact_name: data.contact_name || "",
          company_name: data.company_name || "",
          email: data.email || "",
          phone: data.phone || "",
          payment_method: data.payment_method || "bank_transfer",
          payment_details: data.payment_details || "",
        });
      }
    } catch (error) {
      console.error("Error loading partner data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const { error } = await supabase
        .from("referral_partners")
        .update({
          contact_name: formData.contact_name,
          company_name: formData.company_name,
          phone: formData.phone,
          payment_method: formData.payment_method,
          payment_details: formData.payment_details,
          updated_at: new Date().toISOString(),
        })
        .eq("id", partner.id);

      if (error) throw error;
      setMessage({ type: "success", text: "Profile updated successfully" });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to update profile" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }

    setSaving(true);
    try {
      await updatePassword(passwordData.newPassword);
      setPasswordData({ newPassword: "", confirmPassword: "" });
      setMessage({ type: "success", text: "Password updated successfully" });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to update password" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-12 max-w-2xl">
      {/* Header */}
      <div className="mb-12">
        <p className="text-neutral-500 text-sm uppercase tracking-wider mb-2">Settings</p>
        <h1 className="text-4xl font-medium text-white mb-2">Account Settings</h1>
        <p className="text-neutral-500 text-lg">
          Manage your profile and payment details.
        </p>
      </div>

      {/* Message */}
      {message.text && (
        <div
          className={`mb-8 p-4 rounded-lg flex items-center gap-3 ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {message.type === "success" && <Check className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-6">
        <h2 className="text-white font-medium mb-6">Profile Information</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-neutral-400 text-sm mb-2">Contact Name</label>
              <input
                type="text"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                className="w-full h-11 px-4 bg-black border border-neutral-800 rounded-lg text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-neutral-400 text-sm mb-2">Company Name</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full h-11 px-4 bg-black border border-neutral-800 rounded-lg text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-neutral-400 text-sm mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full h-11 px-4 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-500 cursor-not-allowed"
              />
              <p className="text-neutral-600 text-xs mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="block text-neutral-400 text-sm mb-2">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full h-11 px-4 bg-black border border-neutral-800 rounded-lg text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-11 px-6 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>

      {/* Payment Details Section */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-6">
        <h2 className="text-white font-medium mb-6">Payment Details</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-neutral-400 text-sm mb-2">Payment Method</label>
            <select
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
              className="w-full h-11 px-4 bg-black border border-neutral-800 rounded-lg text-white focus:border-neutral-700 focus:outline-none"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="paypal">PayPal</option>
              <option value="check">Check</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-neutral-400 text-sm mb-2">Payment Details</label>
            <textarea
              value={formData.payment_details}
              onChange={(e) => setFormData({ ...formData, payment_details: e.target.value })}
              placeholder={
                formData.payment_method === "bank_transfer"
                  ? "Bank name, routing number, account number..."
                  : formData.payment_method === "paypal"
                  ? "PayPal email address..."
                  : "Payment instructions..."
              }
              rows={3}
              className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-lg text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:outline-none resize-none"
            />
            <p className="text-neutral-600 text-xs mt-1">
              This information is only visible to you and the Harmon Digital team.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-11 px-6 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Payment Details"}
          </button>
        </form>
      </div>

      {/* Commission Terms (Read-only) */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-6">
        <h2 className="text-white font-medium mb-6">Commission Terms</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-neutral-800">
            <span className="text-neutral-400">Commission Rate</span>
            <span className="text-white font-medium">{partner?.commission_rate || 15}%</span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-neutral-400">Commission Period</span>
            <span className="text-white font-medium">{partner?.commission_months || 6} months</span>
          </div>
        </div>
        <p className="text-neutral-600 text-xs mt-4">
          To request changes to your commission terms, please contact your partner manager.
        </p>
      </div>

      {/* Change Password Section */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <h2 className="text-white font-medium mb-6">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-neutral-400 text-sm mb-2">New Password</label>
            <input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              placeholder="Enter new password"
              className="w-full h-11 px-4 bg-black border border-neutral-800 rounded-lg text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-neutral-400 text-sm mb-2">Confirm Password</label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              placeholder="Confirm new password"
              className="w-full h-11 px-4 bg-black border border-neutral-800 rounded-lg text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-11 px-6 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            {saving ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
