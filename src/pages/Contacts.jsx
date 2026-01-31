import React, { useState, useEffect } from "react";
import { Contact, Account, Activity } from "@/api/entities";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Mail, Phone, Building2, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Card, CardContent } from "@/components/ui/card";
import ContactForm from "../components/contacts/ContactForm";
import ActivityForm from "../components/contacts/ActivityForm";

export default function Contacts() {
  const { user: authUser, userProfile } = useAuth();
  const [contacts, setContacts] = useState([]);
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

  const roleColors = {
    primary: "bg-blue-100 text-blue-800",
    billing: "bg-green-100 text-green-800",
    technical: "bg-purple-100 text-purple-800",
    stakeholder: "bg-gray-100 text-gray-800"
  };

  const activityIcons = {
    email: "📧",
    phone_call: "📞",
    meeting: "👥",
    note: "📝",
    task: "✅",
    other: "📋"
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 mt-1">Manage your contacts and activities</p>
        </div>
        <Button 
          onClick={() => {
            setEditingContact(null);
            setSelectedContact(null);
            setShowDrawer(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Contact
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map(account => (
                <SelectItem key={account.id} value={account.id}>
                  {account.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="primary">Primary Contact</SelectItem>
              <SelectItem value="billing">Billing Contact</SelectItem>
              <SelectItem value="technical">Technical Contact</SelectItem>
              <SelectItem value="stakeholder">Stakeholder</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Activities</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  {contacts.length === 0 ? "No contacts yet. Click \"New Contact\" to get started." : "No contacts match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((contact) => {
                const contactActivities = getContactActivities(contact.id);
                return (
                  <TableRow key={contact.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="font-medium cursor-pointer hover:text-indigo-600" onClick={() => handleViewContact(contact)}>
                        {contact.first_name} {contact.last_name}
                      </div>
                      {contact.title && (
                        <div className="text-sm text-gray-500">{contact.title}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        {getAccountName(contact.account_id)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <a href={`mailto:${contact.email}`} className="text-gray-600 hover:text-indigo-600 flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {contact.email}
                      </a>
                    </TableCell>
                    <TableCell>
                      {contact.phone ? (
                        <a href={`tel:${contact.phone}`} className="text-gray-600 hover:text-indigo-600 flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {contact.phone}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={roleColors[contact.role]}>
                        {contact.role.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedContact(contact);
                          setEditingContact(contact);
                          setShowDrawer(true);
                        }}
                        className="text-gray-600 hover:text-indigo-600"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        {contactActivities.length}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewContact(contact)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteDialog({ open: true, contactId: contact.id })}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Contact Drawer with Tabs */}
      <Sheet open={showDrawer} onOpenChange={setShowDrawer}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingContact ? `${editingContact.first_name} ${editingContact.last_name}` : "New Contact"}</SheetTitle>
            <SheetDescription>
              {editingContact ? "Manage contact details and activities" : "Create a new contact"}
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="details" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Contact Details</TabsTrigger>
              <TabsTrigger value="activities" disabled={!editingContact}>
                Activities ({editingContact ? getContactActivities(editingContact.id).length : 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-6">
              <ContactForm
                contact={editingContact}
                accounts={accounts}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setShowDrawer(false);
                  setEditingContact(null);
                  setSelectedContact(null);
                }}
              />
            </TabsContent>

            <TabsContent value="activities" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Activity Timeline</h3>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingActivity(null);
                    setShowActivityDialog(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Log Activity
                </Button>
              </div>

              {getContactActivities(editingContact?.id).length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500 mb-4">No activities logged yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingActivity(null);
                      setShowActivityDialog(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Log First Activity
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {getContactActivities(editingContact?.id).map((activity) => (
                    <Card key={activity.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-2xl">{activityIcons[activity.type]}</span>
                              <div>
                                <h4 className="font-semibold text-gray-900">{activity.subject}</h4>
                                <p className="text-xs text-gray-500">
                                  {new Date(activity.date).toLocaleString()}
                                  {activity.duration_minutes > 0 && ` • ${activity.duration_minutes} min`}
                                </p>
                              </div>
                            </div>
                            {activity.description && (
                              <p className="text-sm text-gray-600 mt-2">{activity.description}</p>
                            )}
                            {activity.outcome && (
                              <Badge variant="outline" className="mt-2">
                                {activity.outcome.replace('_', ' ')}
                              </Badge>
                            )}
                            {activity.next_action && (
                              <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                                <p className="text-xs font-medium text-yellow-800">Next: {activity.next_action}</p>
                                {activity.next_action_date && (
                                  <p className="text-xs text-yellow-600">
                                    Due: {new Date(activity.next_action_date).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingActivity(activity);
                                setShowActivityDialog(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (confirm('Delete this activity?')) {
                                  await Activity.delete(activity.id);
                                  loadData();
                                }
                              }}
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
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

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