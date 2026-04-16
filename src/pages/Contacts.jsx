import React, { useState, useEffect, useMemo } from "react";
import { Contact, Account, Activity } from "@/api/entities";
import { parseLocalDate } from "@/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Mail, Phone, Building2, MessageSquare, Filter, UserPlus, Check } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { toast } from "@/lib/toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import FormShell from "@/components/ui/FormShell";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import ContactForm from "../components/contacts/ContactForm";
import ActivityForm from "../components/contacts/ActivityForm";

export default function Contacts() {
  const { user: authUser, userProfile } = useAuth();
  const isAdmin = userProfile?.role === "admin";
  const [contacts, setContacts] = useState([]);
  const [invitingContactId, setInvitingContactId] = useState(null);

  const inviteToPortal = async (contact) => {
    if (!contact?.email) {
      toast.error("This contact has no email address");
      return;
    }
    if (contact.portal_user_id) {
      toast.info("Already has portal access");
      return;
    }
    setInvitingContactId(contact.id);
    try {
      const { data, error } = await supabase.functions.invoke("invite-client-portal", {
        body: { contactId: contact.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Invite sent to ${contact.email}`);
      // Reflect the new portal_user_id in local state
      setContacts((prev) =>
        prev.map((c) => (c.id === contact.id ? { ...c, portal_user_id: data.userId, portal_invited_at: new Date().toISOString() } : c))
      );
    } catch (err) {
      console.error("invite failed:", err);
      toast.error("Invite failed", { description: err.message });
    } finally {
      setInvitingContactId(null);
    }
  };
  const [accounts, setAccounts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const [deleteDialog, setDeleteDialog] = useState({ open: false, contactId: null });
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [contactsData, accountsData, activitiesData] = await Promise.all([
        Contact.list("-created_at"),
        Account.list(),
        Activity.list("-date")
      ]);

      setContacts(contactsData);
      setAccounts(accountsData);
      setActivities(activitiesData);
    } catch (error) {
      console.error("Error loading contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (contactData) => {
    try {
      if (editingContact) {
        await Contact.update(editingContact.id, contactData);
      } else {
        await Contact.create(contactData);
      }
      setShowDrawer(false);
      setEditingContact(null);
      loadData();
    } catch (error) {
      console.error("Error saving contact:", error);
    }
  };

  const handleDelete = async () => {
    if (deleteDialog.contactId) {
      try {
        await Contact.delete(deleteDialog.contactId);
        setDeleteDialog({ open: false, contactId: null });
        loadData();
      } catch (error) {
        console.error("Error deleting contact:", error);
      }
    }
  };

  const handleActivitySubmit = async (activityData) => {
    try {
      if (editingActivity) {
        await Activity.update(editingActivity.id, activityData);
      } else {
        await Activity.create(activityData);
      }
      setShowActivityDialog(false);
      setEditingActivity(null);
      loadData();
    } catch (error) {
      console.error("Error saving activity:", error);
    }
  };

  const handleViewContact = (contact) => {
    setSelectedContact(contact);
    setEditingContact(contact);
    setShowDrawer(true);
  };

  const getAccountName = (accountId) => {
    return accounts.find(a => a.id === accountId)?.company_name || "Unknown";
  };

  const getContactActivities = (contactId) => {
    return activities.filter(a => a.contact_id === contactId);
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = searchQuery === "" ||
      contact.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAccount = accountFilter === "all" || contact.account_id === accountFilter;
    const matchesRole = roleFilter === "all" || contact.role === roleFilter;

    return matchesSearch && matchesAccount && matchesRole;
  });

  const roleTextColors = {
    primary: "text-blue-600",
    billing: "text-green-600",
    technical: "text-purple-600",
    stakeholder: "text-gray-500",
  };

  const activityIcons = {
    email: "📧",
    phone_call: "📞",
    meeting: "👥",
    note: "📝",
    task: "✅",
    other: "📋"
  };

  const stats = useMemo(() => {
    const primary = contacts.filter(c => c.role === "primary").length;
    const billing = contacts.filter(c => c.role === "billing").length;
    const technical = contacts.filter(c => c.role === "technical").length;
    return { primary, billing, technical, total: contacts.length };
  }, [contacts]);

  const activeFilterCount =
    (accountFilter !== "all" ? 1 : 0) +
    (roleFilter !== "all" ? 1 : 0);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      {/* Page header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <h1 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Contacts</h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-gray-600 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Primary <span className="text-gray-900 dark:text-gray-100 font-medium">{stats.primary}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Billing <span className="text-gray-900 dark:text-gray-100 font-medium">{stats.billing}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              Technical <span className="text-gray-900 dark:text-gray-100 font-medium">{stats.technical}</span>
            </span>
            <span>Total <span className="text-gray-900 dark:text-gray-100 font-medium">{stats.total}</span></span>
          </div>
        </div>
      </div>

      {/* Consolidated toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2 px-4 h-12">
          <div className="relative flex-1 max-w-md min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-3.5 h-3.5" />
            <Input
              placeholder="Search contacts"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-[13px] border-gray-200 dark:border-gray-800 focus-visible:ring-1"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5 h-8 text-[13px]">
                <Filter className="w-3.5 h-3.5" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-semibold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Filters</span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    className="text-xs text-indigo-600 hover:text-indigo-700"
                    onClick={() => {
                      setAccountFilter("all");
                      setRoleFilter("all");
                    }}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Account</label>
                <Select value={accountFilter} onValueChange={setAccountFilter}>
                  <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Role</label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="primary">Primary Contact</SelectItem>
                    <SelectItem value="billing">Billing Contact</SelectItem>
                    <SelectItem value="technical">Technical Contact</SelectItem>
                    <SelectItem value="stakeholder">Stakeholder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>

          <div className="ml-auto flex items-center gap-1.5">
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open("/ClientPortalAdmin", "_self")}
                className="h-7 px-2.5 text-[13px] border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                title="Manage client portal access"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" />
                Portal access
              </Button>
            )}
            <Button
              onClick={() => {
                setEditingContact(null);
                setSelectedContact(null);
                setShowDrawer(true);
              }}
              size="sm"
              className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New Contact
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1 min-h-0 bg-white dark:bg-gray-950">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">Loading…</div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
            {contacts.length === 0
              ? 'No contacts yet. Click "New Contact" to get started.'
              : "No contacts match your filters."}
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const contactActivities = getContactActivities(contact.id);
            const initials = `${contact.first_name?.[0] || ""}${contact.last_name?.[0] || ""}`.toUpperCase();
            return (
              <div
                key={contact.id}
                className="group flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer"
                onClick={() => handleViewContact(contact)}
              >
                <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 dark:text-gray-300 flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                  {initials || "?"}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-gray-900 dark:text-gray-100 font-medium truncate">
                    {contact.first_name} {contact.last_name}
                    {contact.title && <span className="text-gray-400 dark:text-gray-500 font-normal ml-1.5">· {contact.title}</span>}
                  </div>
                </div>

                <span className="hidden md:inline-flex items-center gap-1 text-[12px] text-gray-500 w-40 truncate">
                  <Building2 className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <span className="truncate">{getAccountName(contact.account_id)}</span>
                </span>

                <a
                  href={`mailto:${contact.email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hidden md:inline text-[12px] text-gray-500 hover:text-gray-900 dark:text-gray-100 w-52 truncate text-right"
                >
                  {contact.email}
                </a>

                {contact.phone ? (
                  <a
                    href={`tel:${contact.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hidden lg:inline text-[12px] text-gray-500 hover:text-gray-900 dark:text-gray-100 w-28 text-right"
                  >
                    {contact.phone}
                  </a>
                ) : (
                  <span className="hidden lg:inline text-[12px] text-gray-300 dark:text-gray-600 w-28 text-right">—</span>
                )}

                <span className={`text-[11px] capitalize w-20 text-right ${roleTextColors[contact.role] || "text-gray-500"}`}>
                  {(contact.role || "").replace("_", " ") || "—"}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedContact(contact);
                    setEditingContact(contact);
                    setShowDrawer(true);
                  }}
                  className="inline-flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-900 dark:text-gray-100 w-10 justify-end"
                  title="Activities"
                >
                  <MessageSquare className="w-3 h-3" />
                  {contactActivities.length}
                </button>

                {/* Portal access indicator — always visible so it's scannable */}
                {contact.portal_user_id ? (
                  <span
                    title={`Portal access · invited ${contact.portal_invited_at ? new Date(contact.portal_invited_at).toLocaleDateString() : ""}`}
                    className="inline-flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400 w-20 justify-end"
                  >
                    <Check className="w-3 h-3" />
                    Portal
                  </span>
                ) : (
                  <span className="w-20" />
                )}

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  {isAdmin && !contact.portal_user_id && contact.email && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        inviteToPortal(contact);
                      }}
                      disabled={invitingContactId === contact.id}
                      className="p-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50"
                      title="Invite to client portal"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewContact(contact);
                    }}
                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteDialog({ open: true, contactId: contact.id });
                    }}
                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Contact Drawer with Tabs */}
      <FormShell
        open={showDrawer}
        onOpenChange={setShowDrawer}
        storageKey="hdo.contactForm.viewMode"
        title={editingContact ? `${editingContact.first_name} ${editingContact.last_name}` : "New Contact"}
        description={editingContact ? "Manage contact details and activities" : "Create a new contact"}
        sheetClassName="w-full sm:max-w-2xl overflow-y-auto"
      >
        <Tabs defaultValue="details">
            <TabsList className="h-9 bg-transparent p-0 border-b border-gray-200 dark:border-gray-800 rounded-none w-full justify-start gap-5 px-1">
              <TabsTrigger
                value="details"
                className="relative h-9 px-0 text-[13px] font-medium text-gray-500 rounded-none bg-transparent shadow-none data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-transparent data-[state=active]:after:bg-gray-900 dark:data-[state=active]:after:bg-gray-100"
              >
                Details
              </TabsTrigger>
              <TabsTrigger
                value="activities"
                disabled={!editingContact}
                className="relative h-9 px-0 text-[13px] font-medium text-gray-500 rounded-none bg-transparent shadow-none data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-transparent data-[state=active]:after:bg-gray-900 dark:data-[state=active]:after:bg-gray-100 disabled:opacity-40"
              >
                Activities{editingContact ? ` · ${getContactActivities(editingContact.id).length}` : ""}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-5">
              <ContactForm
                contact={editingContact}
                accounts={accounts}
                onSubmit={handleSubmit}
                onContactUpdated={loadData}
                onCancel={() => {
                  setShowDrawer(false);
                  setEditingContact(null);
                  setSelectedContact(null);
                }}
              />
            </TabsContent>

            <TabsContent value="activities" className="mt-6 space-y-4">
              <div className="flex items-center">
                <div className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">
                  Activity Timeline
                </div>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingActivity(null);
                    setShowActivityDialog(true);
                  }}
                  className="h-7 px-2 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Log Activity
                </Button>
              </div>

              {getContactActivities(editingContact?.id).length === 0 ? (
                <div className="py-10 text-center border-t border-gray-200 dark:border-gray-800">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                  <p className="text-[13px] text-gray-500 mb-3">No activities logged yet</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingActivity(null);
                      setShowActivityDialog(true);
                    }}
                    className="h-7 px-2 text-[13px]"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Log First Activity
                  </Button>
                </div>
              ) : (
                <div className="border-t border-gray-200 dark:border-gray-800">
                  {getContactActivities(editingContact?.id).map((activity) => (
                    <div
                      key={activity.id}
                      className="group flex items-start gap-3 px-2 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    >
                      <span className="text-lg flex-shrink-0 leading-none mt-0.5">
                        {activityIcons[activity.type]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-gray-900 dark:text-gray-100 font-medium truncate">
                            {activity.subject}
                          </span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">
                            {parseLocalDate(activity.date).toLocaleString()}
                            {activity.duration_minutes > 0 && ` · ${activity.duration_minutes} min`}
                          </span>
                        </div>
                        {activity.description && (
                          <p className="text-[12px] text-gray-600 dark:text-gray-400 mt-1">{activity.description}</p>
                        )}
                        {activity.outcome && (
                          <span className="inline-block mt-1 text-[11px] text-gray-500 capitalize">
                            {activity.outcome.replace("_", " ")}
                          </span>
                        )}
                        {activity.next_action && (
                          <div className="mt-2 text-[12px] text-yellow-700">
                            Next: {activity.next_action}
                            {activity.next_action_date && (
                              <span className="text-yellow-600 ml-1.5">
                                · Due {new Date(activity.next_action_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingActivity(activity);
                            setShowActivityDialog(true);
                          }}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm("Delete this activity?")) {
                              await Activity.delete(activity.id);
                              loadData();
                            }
                          }}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
      </FormShell>

      {/* Activity Dialog */}
      <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingActivity ? "Edit Activity" : "Log New Activity"}</DialogTitle>
            <DialogDescription>
              {editingActivity ? "Update activity details" : `Log an activity for ${selectedContact?.first_name} ${selectedContact?.last_name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <ActivityForm
              activity={editingActivity}
              contactId={selectedContact?.id}
              accountId={selectedContact?.account_id}
              onSubmit={handleActivitySubmit}
              onCancel={() => {
                setShowActivityDialog(false);
                setEditingActivity(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this contact? This will also delete all associated activities. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, contactId: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
