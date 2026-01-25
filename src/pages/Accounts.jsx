
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Account, Contact } from "@/api/entities";
import { User } from "@/api/entities";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Building2, Search, Edit, Trash2, Mail, Phone, Users } from "lucide-react";
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import AccountForm from "../components/accounts/AccountForm";

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");

  const [deleteDialog, setDeleteDialog] = useState({ open: false, accountId: null });
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showContactsDialog, setShowContactsDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      const [accountsData, contactsData] = await Promise.all([
        Account.list("-created_date"),
        Contact.list()
      ]);
      
      setAccounts(accountsData);
      setContacts(contactsData);
    } catch (error) {
      console.error("Error loading accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (accountData) => {
    try {
      if (editingAccount) {
        await Account.update(editingAccount.id, accountData);
      } else {
        await Account.create(accountData);
      }
      setShowDrawer(false);
      setEditingAccount(null);
      loadData();
    } catch (error) {
      console.error("Error saving account:", error);
    }
  };

  const handleDelete = async () => {
    if (deleteDialog.accountId) {
      try {
        await Account.delete(deleteDialog.accountId);
        setDeleteDialog({ open: false, accountId: null });
        loadData();
      } catch (error) {
        console.error("Error deleting account:", error);
      }
    }
  };

  const getAccountContacts = (accountId) => {
    return contacts.filter(c => c.account_id === accountId);
  };

  const handleViewContacts = (account) => {
    setSelectedAccount(account);
    setShowContactsDialog(true);
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = searchQuery === "" || 
      account.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.website?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || account.status === statusFilter;
    const matchesIndustry = industryFilter === "all" || account.industry === industryFilter;
    
    return matchesSearch && matchesStatus && matchesIndustry;
  });

  const statusColors = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    paused: "bg-yellow-100 text-yellow-800"
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-500 mt-1">Manage your client accounts</p>
        </div>
        <Button 
          onClick={() => {
            setEditingAccount(null);
            setShowDrawer(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Account
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>

          <Select value={industryFilter} onValueChange={setIndustryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
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
        
        {(searchQuery || statusFilter !== "all" || industryFilter !== "all") && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-gray-600">Active filters:</span>
            <div className="flex gap-2 flex-wrap">
              {searchQuery && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setSearchQuery("")}>
                  Search: {searchQuery} ×
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setStatusFilter("all")}>
                  Status: {statusFilter} ×
                </Badge>
              )}
              {industryFilter !== "all" && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setIndustryFilter("all")}>
                  Industry: {industryFilter} ×
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  {accounts.length === 0 ? "No accounts yet. Click \"New Account\" to get started." : "No accounts match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filteredAccounts.map((account) => {
                const accountContacts = getAccountContacts(account.id);
                return (
                  <TableRow key={account.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {account.logo_url ? (
                          <img 
                            src={account.logo_url} 
                            alt={account.company_name} 
                            className="w-10 h-10 rounded object-contain bg-gray-50 p-1 border"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className={`w-10 h-10 bg-indigo-100 rounded flex items-center justify-center ${account.logo_url ? 'hidden' : ''}`}
                        >
                          <Building2 className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <div className="font-medium">{account.company_name}</div>
                          {account.website && (
                            <a 
                              href={account.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-gray-500 hover:text-indigo-600"
                            >
                              {account.website}
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">
                      {account.industry || '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewContacts(account)}
                        className="text-gray-600 hover:text-indigo-600"
                      >
                        <Users className="w-4 h-4 mr-1" />
                        {accountContacts.length} contact{accountContacts.length !== 1 ? 's' : ''}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[account.status]}>
                        {account.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingAccount(account);
                            setShowDrawer(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteDialog({ open: true, accountId: account.id })}
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

      {/* Account Form Drawer */}
      <Sheet open={showDrawer} onOpenChange={setShowDrawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingAccount ? "Edit Account" : "New Account"}</SheetTitle>
            <SheetDescription>
              {editingAccount ? "Update account details" : "Create a new client account"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <AccountForm
              account={editingAccount}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowDrawer(false);
                setEditingAccount(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Contacts Dialog */}
      <Dialog open={showContactsDialog} onOpenChange={setShowContactsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contacts for {selectedAccount?.company_name}</DialogTitle>
            <DialogDescription>
              View all contacts associated with this account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {getAccountContacts(selectedAccount?.id).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No contacts for this account yet</p>
                <Link to={createPageUrl("Contacts")}>
                  <Button variant="outline" size="sm" className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Contact
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {getAccountContacts(selectedAccount?.id).map((contact) => (
                  <Card key={contact.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">
                            {contact.first_name} {contact.last_name}
                          </h3>
                          <p className="text-sm text-gray-600">{contact.title}</p>
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Mail className="w-4 h-4" />
                              <a href={`mailto:${contact.email}`} className="hover:text-indigo-600">
                                {contact.email}
                              </a>
                            </div>
                            {contact.phone && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="w-4 h-4" />
                                <a href={`tel:${contact.phone}`} className="hover:text-indigo-600">
                                  {contact.phone}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {contact.role}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Link to={createPageUrl("Contacts")}>
              <Button variant="outline">
                Manage Contacts
              </Button>
            </Link>
            <Button onClick={() => setShowContactsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this account? This action cannot be undone and will affect all related projects, contacts, and data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, accountId: null })}
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
