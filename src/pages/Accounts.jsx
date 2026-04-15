import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Account, Contact } from "@/api/entities";
import { useAuth } from "@/contexts/AuthContext";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Building2, Search, Edit, Trash2, Mail, Phone, Users, Filter, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import AccountForm from "../components/accounts/AccountForm";

export default function Accounts() {
  const { user: authUser, userProfile } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
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
      const [accountsData, contactsData] = await Promise.all([
        Account.list("-created_at"),
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

  const stats = useMemo(() => {
    const active = accounts.filter(a => a.status === "active").length;
    const paused = accounts.filter(a => a.status === "paused").length;
    const inactive = accounts.filter(a => a.status === "inactive").length;
    return { active, paused, inactive, total: accounts.length };
  }, [accounts]);

  const statusTextColors = {
    active: "text-green-600",
    inactive: "text-gray-500",
    paused: "text-yellow-600",
  };

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (industryFilter !== "all" ? 1 : 0);

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Page header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h1 className="text-[15px] font-semibold text-gray-900">Accounts</h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Active <span className="text-gray-900 font-medium">{stats.active}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              Paused <span className="text-gray-900 font-medium">{stats.paused}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              Inactive <span className="text-gray-900 font-medium">{stats.inactive}</span>
            </span>
            <span>Total <span className="text-gray-900 font-medium">{stats.total}</span></span>
          </div>
        </div>
      </div>

      {/* Consolidated toolbar */}
      <div className="border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-4 h-12">
          <div className="relative flex-1 max-w-md min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <Input
              placeholder="Search accounts"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-[13px] border-gray-200 focus-visible:ring-1"
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
                      setStatusFilter("all");
                      setIndustryFilter("all");
                    }}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Industry</label>
                <Select value={industryFilter} onValueChange={setIndustryFilter}>
                  <SelectTrigger><SelectValue placeholder="Industry" /></SelectTrigger>
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
            </PopoverContent>
          </Popover>

          <div className="ml-auto">
            <Button
              onClick={() => {
                setEditingAccount(null);
                setShowDrawer(true);
              }}
              size="sm"
              className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New Account
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1 min-h-0 bg-white">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {accounts.length === 0
              ? 'No accounts yet. Click "New Account" to get started.'
              : "No accounts match your filters."}
          </div>
        ) : (
          filteredAccounts.map((account) => {
            const accountContacts = getAccountContacts(account.id);
            const initials = (account.company_name || "?")
              .split(" ")
              .map((w) => w[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <div
                key={account.id}
                className="group flex items-center gap-3 px-2 py-2 border-b border-gray-100 hover:bg-gray-50"
              >
                {account.logo_url ? (
                  <img
                    src={account.logo_url}
                    alt={account.company_name}
                    className="w-6 h-6 rounded object-contain bg-gray-50 border border-gray-100 flex-shrink-0"
                    onError={(e) => {
                      e.target.style.display = "none";
                      if (e.target.nextSibling) {
                        e.target.nextSibling.style.display = "flex";
                      }
                    }}
                  />
                ) : null}
                <div
                  className={`w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${account.logo_url ? "hidden" : ""}`}
                >
                  {initials || <Building2 className="w-3.5 h-3.5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-gray-900 font-medium truncate">
                    {account.company_name}
                    {account.website && (
                      <a
                        href={account.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-400 font-normal ml-1.5 hover:text-gray-700"
                      >
                        · {account.website.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                  </div>
                </div>

                <span className="hidden md:inline text-[11px] capitalize text-gray-500 w-28 text-right truncate">
                  {account.industry || "—"}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewContacts(account);
                  }}
                  className="hidden md:inline-flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-900 w-24 justify-end"
                >
                  <Users className="w-3 h-3" />
                  {accountContacts.length}
                </button>

                <span className={`text-[11px] capitalize w-16 text-right ${statusTextColors[account.status] || "text-gray-500"}`}>
                  {account.status || "—"}
                </span>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingAccount(account);
                      setShowDrawer(true);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-900"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteDialog({ open: true, accountId: account.id });
                    }}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
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

          <div className="border-t border-gray-200">
            {getAccountContacts(selectedAccount?.id).length === 0 ? (
              <div className="py-10 text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-[13px] text-gray-500">No contacts for this account yet</p>
                <Link to={createPageUrl("Contacts")}>
                  <Button variant="ghost" className="mt-3 h-7 px-2 text-[13px]">
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Contact
                  </Button>
                </Link>
              </div>
            ) : (
              getAccountContacts(selectedAccount?.id).map((contact) => {
                const initials = `${contact.first_name?.[0] || ""}${contact.last_name?.[0] || ""}`.toUpperCase();
                return (
                  <div
                    key={contact.id}
                    className="group flex items-center gap-3 px-2 py-2 border-b border-gray-100 hover:bg-gray-50"
                  >
                    <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                      {initials || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-gray-900 truncate">
                        {contact.first_name} {contact.last_name}
                        {contact.title && <span className="text-gray-400 font-normal ml-1.5">· {contact.title}</span>}
                      </div>
                    </div>
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-[12px] text-gray-500 hover:text-gray-900 w-52 truncate text-right"
                    >
                      {contact.email}
                    </a>
                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-[12px] text-gray-500 hover:text-gray-900 w-28 text-right"
                      >
                        {contact.phone}
                      </a>
                    ) : (
                      <span className="text-[12px] text-gray-300 w-28 text-right">—</span>
                    )}
                    <span className="text-[11px] capitalize text-gray-500 w-20 text-right">
                      {contact.role || "—"}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Link to={createPageUrl("Contacts")}>
              <Button variant="outline" size="sm" className="h-8 text-[13px]">
                Manage Contacts
              </Button>
            </Link>
            <Button
              size="sm"
              className="bg-gray-900 hover:bg-gray-800 text-white h-8 text-[13px]"
              onClick={() => setShowContactsDialog(false)}
            >
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
