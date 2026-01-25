import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Image as ImageIcon, Plus, Mail, Phone, Edit, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function AccountForm({ account, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(account || {
    company_name: "",
    logo_url: "",
    website: "",
    industry: "technology",
    status: "active",
    notes: ""
  });

  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(account?.logo_url || "");
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, contactId: null });

  // Contact form state
  const [contactFormData, setContactFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    title: "",
    role: "stakeholder",
    stripe_customer_id: "",
    notes: ""
  });

  useEffect(() => {
    if (account?.id) {
      loadContacts();
    }
  }, [account?.id]);

  const loadContacts = async () => {
    if (!account?.id) return;
    
    setLoadingContacts(true);
    try {
      const contactsData = await base44.entities.Contact.filter({ account_id: account.id });
      setContacts(contactsData);
    } catch (error) {
      console.error("Error loading contacts:", error);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const response = await base44.integrations.Core.UploadFile({ file });
      
      if (response.file_url) {
        setFormData({ ...formData, logo_url: response.file_url });
        setLogoPreview(response.file_url);
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setFormData({ ...formData, logo_url: "" });
    setLogoPreview("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleAddContact = () => {
    setEditingContact(null);
    setContactFormData({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      title: "",
      role: "stakeholder",
      stripe_customer_id: "",
      notes: ""
    });
    setShowContactForm(true);
  };

  const handleEditContact = (contact) => {
    setEditingContact(contact);
    setContactFormData({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      phone: contact.phone || "",
      title: contact.title || "",
      role: contact.role,
      stripe_customer_id: contact.stripe_customer_id || "",
      notes: contact.notes || ""
    });
    setShowContactForm(true);
  };

  const handleSaveContact = async () => {
    try {
      if (editingContact) {
        await base44.entities.Contact.update(editingContact.id, {
          ...contactFormData,
          account_id: account.id
        });
      } else {
        await base44.entities.Contact.create({
          ...contactFormData,
          account_id: account.id
        });
      }
      setShowContactForm(false);
      setEditingContact(null);
      loadContacts();
    } catch (error) {
      console.error("Error saving contact:", error);
      alert("Failed to save contact. Please try again.");
    }
  };

  const handleDeleteContact = async () => {
    if (deleteDialog.contactId) {
      try {
        await base44.entities.Contact.delete(deleteDialog.contactId);
        setDeleteDialog({ open: false, contactId: null });
        loadContacts();
      } catch (error) {
        console.error("Error deleting contact:", error);
        alert("Failed to delete contact. Please try again.");
      }
    }
  };

  const roleColors = {
    primary: "bg-blue-100 text-blue-800",
    billing: "bg-green-100 text-green-800",
    technical: "bg-purple-100 text-purple-800",
    stakeholder: "bg-gray-100 text-gray-800"
  };

  return (
    <div className="space-y-8">
      {/* Account Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Company Logo</Label>
            <div className="flex items-start gap-4">
              {logoPreview ? (
                <div className="relative">
                  <img 
                    src={logoPreview} 
                    alt="Logo preview" 
                    className="w-24 h-24 object-contain border rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <label htmlFor="logo-upload">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => document.getElementById('logo-upload').click()}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  PNG, JPG or GIF (max 5MB)
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name *</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => setFormData({...formData, company_name: e.target.value})}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://example.com"
              value={formData.website}
              onChange={(e) => setFormData({...formData, website: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select value={formData.industry} onValueChange={(value) => setFormData({...formData, industry: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
              placeholder="Additional notes about this account..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={uploading} className="bg-indigo-600 hover:bg-indigo-700">
            {account ? "Update" : "Create"} Account
          </Button>
        </div>
      </form>

      {/* Contacts Section - Only show if account exists */}
      {account?.id && (
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Contacts</h3>
              <p className="text-sm text-gray-500">Manage contacts for this account</p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAddContact}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </div>

          {loadingContacts ? (
            <div className="text-center py-8 text-gray-500">
              Loading contacts...
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <UserPlus className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500 mb-4">No contacts yet</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddContact}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Contact
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <Card key={contact.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">
                            {contact.first_name} {contact.last_name}
                          </h4>
                          <Badge className={roleColors[contact.role]}>
                            {contact.role}
                          </Badge>
                        </div>
                        {contact.title && (
                          <p className="text-sm text-gray-600 mb-2">{contact.title}</p>
                        )}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-3 h-3" />
                            <a href={`mailto:${contact.email}`} className="hover:text-indigo-600">
                              {contact.email}
                            </a>
                          </div>
                          {contact.phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="w-3 h-3" />
                              <a href={`tel:${contact.phone}`} className="hover:text-indigo-600">
                                {contact.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditContact(contact)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteDialog({ open: true, contactId: contact.id })}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contact Form Dialog */}
      <Dialog open={showContactForm} onOpenChange={setShowContactForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Edit Contact" : "New Contact"}</DialogTitle>
            <DialogDescription>
              {editingContact ? "Update contact information" : "Add a new contact for this account"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={contactFormData.first_name}
                  onChange={(e) => setContactFormData({...contactFormData, first_name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={contactFormData.last_name}
                  onChange={(e) => setContactFormData({...contactFormData, last_name: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={contactFormData.email}
                onChange={(e) => setContactFormData({...contactFormData, email: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={contactFormData.phone}
                  onChange={(e) => setContactFormData({...contactFormData, phone: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={contactFormData.title}
                  onChange={(e) => setContactFormData({...contactFormData, title: e.target.value})}
                  placeholder="e.g. CEO, CTO"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select 
                value={contactFormData.role} 
                onValueChange={(value) => setContactFormData({...contactFormData, role: value})}
              >
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

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={contactFormData.notes}
                onChange={(e) => setContactFormData({...contactFormData, notes: e.target.value})}
                rows={2}
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveContact} className="bg-indigo-600 hover:bg-indigo-700">
              {editingContact ? "Update" : "Add"} Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this contact? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, contactId: null })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteContact}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}