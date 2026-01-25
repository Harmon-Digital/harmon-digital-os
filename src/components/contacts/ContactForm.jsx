import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { CreditCard, Link as LinkIcon, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ContactForm({ contact, accounts, onSubmit, onCancel }) {
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

  const [showStripeDialog, setShowStripeDialog] = useState(false);
  const [stripeAction, setStripeAction] = useState(null);
  const [stripeCustomers, setStripeCustomers] = useState([]);
  const [selectedStripeCustomer, setSelectedStripeCustomer] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (showStripeDialog) {
      if (stripeAction === 'search') {
        loadStripeCustomers();
      }
    }
  }, [showStripeDialog, stripeAction]);

  const loadStripeCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const response = await base44.functions.invoke('listStripeCustomers', {});
      if (response.data?.success) {
        setStripeCustomers(response.data.customers);
      }
    } catch (error) {
      console.error('Error loading Stripe customers:', error);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleCreateStripeCustomer = async () => {
    if (!formData.email) {
      alert('Email is required to create a Stripe customer');
      return;
    }

    setProcessing(true);
    try {
      const response = await base44.functions.invoke('createStripeCustomer', {
        email: formData.email,
        name: `${formData.first_name} ${formData.last_name}`,
        contactId: contact?.id,
        accountId: formData.account_id,
      });

      if (response.data?.success) {
        setFormData({ ...formData, stripe_customer_id: response.data.stripe_customer_id });
        setShowStripeDialog(false);
        alert('Stripe customer created successfully!');
      } else {
        throw new Error(response.data?.error || 'Failed to create customer');
      }
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      alert('Failed to create Stripe customer: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleLinkStripeCustomer = async () => {
    if (!selectedStripeCustomer) {
      alert('Please select a Stripe customer');
      return;
    }

    // If contact exists, link directly
    if (contact?.id) {
      setProcessing(true);
      try {
        const response = await base44.functions.invoke('linkStripeCustomer', {
          contactId: contact.id,
          stripeCustomerId: selectedStripeCustomer,
        });

        if (response.data?.success) {
          setFormData({ ...formData, stripe_customer_id: selectedStripeCustomer });
          setShowStripeDialog(false);
          setSelectedStripeCustomer("");
          alert('Stripe customer linked successfully!');
        } else {
          throw new Error(response.data?.error || 'Failed to link customer');
        }
      } catch (error) {
        console.error('Error linking Stripe customer:', error);
        alert('Failed to link Stripe customer: ' + error.message);
      } finally {
        setProcessing(false);
      }
    } else {
      // For new contacts, just set the ID in form data
      setFormData({ ...formData, stripe_customer_id: selectedStripeCustomer });
      setShowStripeDialog(false);
      setSelectedStripeCustomer("");
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>First Name *</Label>
            <Input
              value={formData.first_name}
              onChange={(e) => handleChange("first_name", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Last Name *</Label>
            <Input
              value={formData.last_name}
              onChange={(e) => handleChange("last_name", e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Email *</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="e.g. CEO, CTO"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Account *</Label>
            <Select value={formData.account_id} onValueChange={(value) => handleChange("account_id", value)}>
              <SelectTrigger>
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
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={formData.role} onValueChange={(value) => handleChange("role", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary Contact</SelectItem>
                <SelectItem value="billing">Billing Contact</SelectItem>
                <SelectItem value="technical">Technical Contact</SelectItem>
                <SelectItem value="stakeholder">Stakeholder</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stripe Customer Section */}
        <div className="space-y-2 p-4 border rounded-lg bg-gray-50">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Stripe Customer
            </Label>
            {formData.stripe_customer_id ? (
              <Badge className="bg-green-100 text-green-800">
                Linked
              </Badge>
            ) : (
              <Badge variant="outline">Not Linked</Badge>
            )}
          </div>
          
          {formData.stripe_customer_id ? (
            <div className="text-sm">
              <p className="text-gray-600">Customer ID:</p>
              <p className="font-mono text-xs mt-1">{formData.stripe_customer_id}</p>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStripeAction('create');
                  setShowStripeDialog(true);
                }}
                className="flex-1"
                disabled={!formData.email}
              >
                <Plus className="w-3 h-3 mr-1" />
                Create New
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStripeAction('search');
                  setShowStripeDialog(true);
                }}
                className="flex-1"
              >
                <Search className="w-3 h-3 mr-1" />
                Search & Link
              </Button>
            </div>
          )}
          {!formData.email && !formData.stripe_customer_id && (
            <p className="text-xs text-gray-500">Enter an email to create a Stripe customer</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            value={formData.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            rows={3}
            placeholder="Additional notes about this contact..."
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
            {contact ? "Update Contact" : "Create Contact"}
          </Button>
        </div>
      </form>

      {/* Stripe Customer Dialog */}
      <Dialog open={showStripeDialog} onOpenChange={setShowStripeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {stripeAction === 'create' ? 'Create Stripe Customer' : 'Link Stripe Customer'}
            </DialogTitle>
            <DialogDescription>
              {stripeAction === 'create' 
                ? 'Create a new customer in Stripe for this contact'
                : 'Search and link an existing Stripe customer'}
            </DialogDescription>
          </DialogHeader>

          {stripeAction === 'create' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={formData.email} disabled />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={`${formData.first_name} ${formData.last_name}`} disabled />
              </div>
              <p className="text-sm text-gray-600">
                A new customer will be created in Stripe with this information.
              </p>
            </div>
          )}

          {stripeAction === 'search' && (
            <div className="space-y-4 py-4">
              {loadingCustomers ? (
                <div className="text-center py-8 text-gray-500">
                  Loading Stripe customers...
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Select Stripe Customer *</Label>
                  <Select value={selectedStripeCustomer} onValueChange={setSelectedStripeCustomer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {stripeCustomers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{customer.name}</span>
                            {customer.email && (
                              <span className="text-xs text-gray-500">{customer.email}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {stripeCustomers.length === 0 && (
                    <p className="text-xs text-gray-500">No customers found in Stripe</p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStripeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={stripeAction === 'create' ? handleCreateStripeCustomer : handleLinkStripeCustomer}
              disabled={processing || (stripeAction === 'search' && !selectedStripeCustomer)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {processing ? 'Processing...' : stripeAction === 'create' ? 'Create Customer' : 'Link Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}