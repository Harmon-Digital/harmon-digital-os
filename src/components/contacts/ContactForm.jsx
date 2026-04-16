import React, { useState, useEffect } from "react";
import { api } from "@/api/legacyClient";
import { linkStripeCustomer } from "@/api/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Mail,
  Phone,
  Briefcase,
  Building2,
  UserCircle,
  StickyNote,
  Plus,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { toast } from "@/lib/toast";

/* -------------------------------------------------------------------------- */
/* PropertyRow — small icon + label on the left, control on the right          */
/* -------------------------------------------------------------------------- */
function PropertyRow({ icon: Icon, label, children, required = false }) {
  return (
    <div className="flex items-start gap-3 min-h-[32px]">
      <div className="flex items-center gap-1.5 w-24 shrink-0 text-[12px] text-gray-500 dark:text-gray-400 pt-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span>{label}</span>
        {required && <span className="text-red-500">*</span>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

const ROLES = [
  { id: "primary", label: "Primary" },
  { id: "billing", label: "Billing" },
  { id: "technical", label: "Technical" },
  { id: "stakeholder", label: "Stakeholder" },
];

export default function ContactForm({ contact, accounts = [], onSubmit, onCancel }) {
  const isEdit = !!contact?.id;
  const [formData, setFormData] = useState(
    contact || {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      title: "",
      role: "stakeholder",
      account_id: accounts?.[0]?.id || "",
      stripe_customer_id: "",
      notes: "",
    }
  );

  const [showStripe, setShowStripe] = useState(false);
  const [stripeAction, setStripeAction] = useState(null); // 'create' | 'search'
  const [stripeCustomers, setStripeCustomers] = useState([]);
  const [selectedStripeCustomer, setSelectedStripeCustomer] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (showStripe && stripeAction === "search") loadStripeCustomers();
  }, [showStripe, stripeAction]);

  const loadStripeCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const response = await api.functions.invoke("list-stripe-customers", {});
      if (response.data?.success) setStripeCustomers(response.data.customers);
    } catch (err) {
      console.error("Error loading Stripe customers:", err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.first_name?.trim() || !formData.last_name?.trim()) {
      toast.error("First and last name are required");
      return;
    }
    if (!formData.email?.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!formData.account_id) {
      toast.error("Account is required");
      return;
    }
    const cleaned = {
      ...formData,
      phone: formData.phone || null,
      title: formData.title || null,
      stripe_customer_id: formData.stripe_customer_id || null,
      notes: formData.notes || null,
    };
    onSubmit(cleaned);
  };

  const handleCreateStripe = async () => {
    if (!formData.email) {
      toast.error("Email required to create a Stripe customer");
      return;
    }
    setProcessing(true);
    try {
      const response = await api.functions.invoke("create-stripe-customer", {
        email: formData.email,
        name: `${formData.first_name} ${formData.last_name}`,
        contactId: contact?.id,
        accountId: formData.account_id,
      });
      if (response.data?.success) {
        setFormData((prev) => ({ ...prev, stripe_customer_id: response.data.stripe_customer_id }));
        setShowStripe(false);
        toast.success("Stripe customer created");
      } else {
        throw new Error(response.data?.error || "Failed to create customer");
      }
    } catch (err) {
      toast.error("Couldn't create Stripe customer", { description: err.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleLinkStripe = async () => {
    if (!selectedStripeCustomer) return;
    if (contact?.id) {
      setProcessing(true);
      try {
        const response = await linkStripeCustomer({
          contactId: contact.id,
          stripeCustomerId: selectedStripeCustomer,
        });
        if (response.data?.success) {
          setFormData((prev) => ({ ...prev, stripe_customer_id: selectedStripeCustomer }));
          setShowStripe(false);
          setSelectedStripeCustomer("");
          toast.success("Stripe customer linked");
        } else {
          throw new Error(response.data?.error || "Failed to link customer");
        }
      } catch (err) {
        toast.error("Couldn't link customer", { description: err.message });
      } finally {
        setProcessing(false);
      }
    } else {
      setFormData((prev) => ({ ...prev, stripe_customer_id: selectedStripeCustomer }));
      setShowStripe(false);
      setSelectedStripeCustomer("");
    }
  };

  return (
    <>
      <style>{`
        .contact-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
        .contact-form textarea,
        .contact-form [role="combobox"] {
          border-color: transparent !important;
          background-color: transparent !important;
          box-shadow: none !important;
          transition: background-color 0.12s ease, border-color 0.12s ease;
        }
        .contact-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):hover,
        .contact-form textarea:hover,
        .contact-form [role="combobox"]:hover {
          background-color: rgb(249 250 251) !important;
        }
        .dark .contact-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):hover,
        .dark .contact-form textarea:hover,
        .dark .contact-form [role="combobox"]:hover {
          background-color: rgb(31 41 55) !important;
        }
        .contact-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):focus,
        .contact-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):focus-visible,
        .contact-form textarea:focus,
        .contact-form textarea:focus-visible,
        .contact-form [role="combobox"]:focus,
        .contact-form [role="combobox"][data-state="open"] {
          background-color: white !important;
          border-color: rgb(199 210 254) !important;
          box-shadow: 0 0 0 3px rgb(224 231 255 / 0.45) !important;
          outline: none !important;
        }
        .dark .contact-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):focus,
        .dark .contact-form input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):focus-visible,
        .dark .contact-form textarea:focus,
        .dark .contact-form textarea:focus-visible,
        .dark .contact-form [role="combobox"]:focus,
        .dark .contact-form [role="combobox"][data-state="open"] {
          background-color: rgb(17 24 39) !important;
          border-color: rgb(67 56 202) !important;
          box-shadow: 0 0 0 3px rgb(49 46 129 / 0.35) !important;
        }
        .contact-form .title-input {
          font-size: 20px !important;
          font-weight: 600 !important;
          padding: 4px 8px !important;
          height: auto !important;
          line-height: 1.3 !important;
        }
      `}</style>

      <form onSubmit={handleSubmit} className="contact-form space-y-4">
        {/* Name input as big title */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={formData.first_name}
              onChange={(e) => handleChange("first_name", e.target.value)}
              placeholder="First name"
              required
              className="title-input text-gray-900 dark:text-gray-100 flex-1"
            />
            <Input
              value={formData.last_name}
              onChange={(e) => handleChange("last_name", e.target.value)}
              placeholder="Last name"
              required
              className="title-input text-gray-900 dark:text-gray-100 flex-1"
            />
          </div>
        </div>

        {/* Property rows */}
        <div className="space-y-1 border-t border-gray-100 dark:border-gray-800 pt-3">
          <PropertyRow icon={Mail} label="Email" required>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="you@company.com"
              required
              className="h-8 text-[13px]"
            />
          </PropertyRow>

          <PropertyRow icon={Building2} label="Account" required>
            <Select value={formData.account_id} onValueChange={(v) => handleChange("account_id", v)}>
              <SelectTrigger className="h-8 text-[13px]">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropertyRow>

          <PropertyRow icon={UserCircle} label="Role">
            <Select value={formData.role} onValueChange={(v) => handleChange("role", v)}>
              <SelectTrigger className="h-8 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropertyRow>

          <PropertyRow icon={Briefcase} label="Title">
            <Input
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="CEO, CTO, Manager…"
              className="h-8 text-[13px]"
            />
          </PropertyRow>

          <PropertyRow icon={Phone} label="Phone">
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="h-8 text-[13px]"
            />
          </PropertyRow>
        </div>

        {/* Stripe — compact inline row */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
          <PropertyRow icon={CreditCard} label="Stripe">
            {formData.stripe_customer_id ? (
              <div className="flex items-center gap-2 text-[13px]">
                <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Check className="w-3 h-3" />
                  Linked
                </span>
                <code className="font-mono text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {formData.stripe_customer_id}
                </code>
                <button
                  type="button"
                  onClick={() => handleChange("stripe_customer_id", "")}
                  className="text-[11px] text-gray-500 hover:text-red-600 ml-auto"
                >
                  Unlink
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { setStripeAction("create"); setShowStripe(true); }}
                  disabled={!formData.email}
                  className="inline-flex items-center gap-1 px-2 h-7 rounded-md border border-gray-200 dark:border-gray-700 text-[12px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" />
                  Create new
                </button>
                <button
                  type="button"
                  onClick={() => { setStripeAction("search"); setShowStripe(true); }}
                  className="inline-flex items-center gap-1 px-2 h-7 rounded-md border border-gray-200 dark:border-gray-700 text-[12px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <Search className="w-3 h-3" />
                  Link existing
                </button>
                {!formData.email && (
                  <span className="text-[11px] text-gray-400 ml-1">Enter an email first</span>
                )}
              </div>
            )}
          </PropertyRow>
        </div>

        {/* Notes */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
          <PropertyRow icon={StickyNote} label="Notes">
            <Textarea
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={3}
              placeholder="Additional notes about this contact…"
              className="resize-none text-[13px]"
            />
          </PropertyRow>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="h-8 text-[13px]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="h-8 text-[13px] bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:hover:bg-white dark:text-gray-900"
          >
            {isEdit ? "Save changes" : "Create contact"}
          </Button>
        </div>
      </form>

      {/* Stripe Customer Dialog */}
      <Dialog open={showStripe} onOpenChange={setShowStripe}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              {stripeAction === "create" ? "Create Stripe customer" : "Link existing customer"}
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              {stripeAction === "create"
                ? "A new customer will be created in Stripe with this contact's details."
                : "Search and link an existing Stripe customer to this contact."}
            </DialogDescription>
          </DialogHeader>

          {stripeAction === "create" && (
            <div className="space-y-2 py-2 text-[13px]">
              <div className="flex items-center gap-2 py-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className="w-16 text-[12px] text-gray-500 dark:text-gray-400">Email</span>
                <span className="text-gray-900 dark:text-gray-100">{formData.email}</span>
              </div>
              <div className="flex items-center gap-2 py-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className="w-16 text-[12px] text-gray-500 dark:text-gray-400">Name</span>
                <span className="text-gray-900 dark:text-gray-100">{formData.first_name} {formData.last_name}</span>
              </div>
            </div>
          )}

          {stripeAction === "search" && (
            <div className="py-2">
              {loadingCustomers ? (
                <div className="flex items-center justify-center py-6 text-gray-400 text-[13px]">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading…
                </div>
              ) : (
                <>
                  <Select value={selectedStripeCustomer} onValueChange={setSelectedStripeCustomer}>
                    <SelectTrigger className="h-9 text-[13px]">
                      <SelectValue placeholder="Choose a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {stripeCustomers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{c.name || c.email}</span>
                            {c.email && c.name && <span className="text-[11px] text-gray-500">{c.email}</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {stripeCustomers.length === 0 && (
                    <p className="text-[11px] text-gray-500 mt-2">No customers found in Stripe</p>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowStripe(false)} className="h-8 text-[13px]">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={stripeAction === "create" ? handleCreateStripe : handleLinkStripe}
              disabled={processing || (stripeAction === "search" && !selectedStripeCustomer)}
              className="h-8 text-[13px] bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:hover:bg-white dark:text-gray-900"
            >
              {processing ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Processing…</>
              ) : stripeAction === "create" ? (
                "Create customer"
              ) : (
                "Link customer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
