import React, { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Check, Send } from "lucide-react";

export default function PartnerSubmitReferral() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [partner, setPartner] = useState(null);
  const [formData, setFormData] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    client_company: "",
    notes: "",
  });
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (user) {
      loadPartner();
    }
  }, [user]);

  const loadPartner = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("referral_partners")
        .select("id, contact_name, commission_rate, commission_months")
        .eq("user_id", user.id)
        .single();

      setPartner(data);
    } catch (error) {
      console.error("Error loading partner:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!partner) return;

    setSubmitting(true);
    setMessage({ type: "", text: "" });

    try {
      // Create the referral
      const { data: referralData, error } = await supabase
        .from("referrals")
        .insert({
          partner_id: partner.id,
          client_name: formData.client_name,
          client_email: formData.client_email,
          client_phone: formData.client_phone || null,
          client_company: formData.client_company || null,
          notes: formData.notes || null,
          status: "pending",
          commission_rate: partner.commission_rate || 15,
          commission_months: partner.commission_months || 6,
          referral_date: new Date().toISOString().split("T")[0],
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Also create a lead in the CRM
      await supabase.from("leads").insert({
        company_name: formData.client_company || formData.client_name,
        contact_name: formData.client_name,
        email: formData.client_email,
        phone: formData.client_phone || null,
        source: `Partner Referral - ${partner.contact_name}`,
        status: "new",
        notes: formData.notes || null,
        next_action: "Follow up on partner referral",
        referral_id: referralData.id,
      });

      // Notify all admins about the new referral
      const { data: admins } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("role", "admin");

      if (admins?.length) {
        await supabase.from("notifications").insert(
          admins.map((admin) => ({
            user_id: admin.id,
            type: "referral",
            title: "New Referral Submitted",
            message: `${partner.contact_name} submitted a referral for ${formData.client_name}`,
            link: "/Partners",
            read: false,
          }))
        );
      }

      setMessage({ type: "success", text: "Referral submitted successfully! We'll be in touch soon." });
      setFormData({
        client_name: "",
        client_email: "",
        client_phone: "",
        client_company: "",
        notes: "",
      });

      // Navigate to referrals list after a short delay
      setTimeout(() => {
        navigate("/partner/referrals");
      }, 2000);
    } catch (error) {
      console.error("Error submitting referral:", error);
      setMessage({ type: "error", text: error.message || "Failed to submit referral" });
    } finally {
      setSubmitting(false);
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
        <p className="text-neutral-500 text-sm uppercase tracking-wider mb-2">Referrals</p>
        <h1 className="text-4xl font-medium text-white mb-2">Submit a Referral</h1>
        <p className="text-neutral-500 text-lg">
          Share a potential client with us. We'll reach out and keep you updated.
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

      {/* Form */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-neutral-400 text-sm mb-2">
              Contact Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.client_name}
              onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
              placeholder="John Smith"
              className="w-full h-11 px-4 bg-black border border-neutral-800 rounded-lg text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-neutral-400 text-sm mb-2">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={formData.client_email}
                onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                placeholder="john@company.com"
                className="w-full h-11 px-4 bg-black border border-neutral-800 rounded-lg text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-neutral-400 text-sm mb-2">Phone</label>
              <input
                type="text"
                value={formData.client_phone}
                onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                placeholder="(555) 123-4567"
                className="w-full h-11 px-4 bg-black border border-neutral-800 rounded-lg text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-neutral-400 text-sm mb-2">Company</label>
            <input
              type="text"
              value={formData.client_company}
              onChange={(e) => setFormData({ ...formData, client_company: e.target.value })}
              placeholder="Acme Inc."
              className="w-full h-11 px-4 bg-black border border-neutral-800 rounded-lg text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-neutral-400 text-sm mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Tell us about this potential client - what services are they interested in? Any relevant background info?"
              rows={4}
              className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-lg text-white placeholder:text-neutral-600 focus:border-neutral-700 focus:outline-none resize-none"
            />
          </div>

          <div className="pt-4 border-t border-neutral-800">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-neutral-400 text-sm">Your Commission Terms</p>
                <p className="text-white">
                  {partner?.commission_rate || 15}% for {partner?.commission_months || 6} months
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 w-full h-12 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-neutral-400 border-t-black rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Referral
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Info */}
      <div className="mt-8 p-6 bg-neutral-950 border border-neutral-800 rounded-xl">
        <h3 className="text-white font-medium mb-3">How it works</h3>
        <ol className="space-y-3 text-neutral-400 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-neutral-800 rounded-full flex items-center justify-center text-white text-xs">1</span>
            <span>Submit your referral's contact information above</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-neutral-800 rounded-full flex items-center justify-center text-white text-xs">2</span>
            <span>We'll reach out to them and discuss their needs</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-neutral-800 rounded-full flex items-center justify-center text-white text-xs">3</span>
            <span>Once they become a client, you'll start earning commissions</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-neutral-800 rounded-full flex items-center justify-center text-white text-xs">4</span>
            <span>Track your earnings in the dashboard and get paid monthly</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
