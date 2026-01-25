
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Clock, AlertCircle, CheckSquare, Info, Edit2, X, Trash2, FileText, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function Reports() {
  const [timeEntries, setTimeEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [stripeCustomers, setStripeCustomers] = useState([]);
  const [stripeProducts, setStripeProducts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [projectFilter, setProjectFilter] = useState("all");
  const [teamMemberFilter, setTeamMemberFilter] = useState("all");
  const [billingFilter, setBillingFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Bulk selection and editing
  const [selectedEntries, setSelectedEntries] = useState([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState({
    customer_id: "",
    due_days: 30,
    notes: "",
    line_items: [],
    send_immediately: true // Added option to control sending
  });
  const [bulkEditData, setBulkEditData] = useState({
    project_id: "",
    team_member_id: "",
    billable: "",
    client_billed: "",
    contractor_paid: "",
    description: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [user, projectsData, timeData, teamData, accountsData, contactsData, productsData] = await Promise.all([
        base44.auth.me(),
        base44.entities.Project.list(),
        base44.entities.TimeEntry.list(),
        base44.entities.TeamMember.list(),
        base44.entities.Account.list(),
        base44.entities.Contact.list(),
        base44.entities.StripeProduct.list()
      ]);

      setCurrentUser(user);
      setProjects(projectsData);
      setTimeEntries(timeData);
      setTeamMembers(teamData);
      setAccounts(accountsData);
      setContacts(contactsData);
      setStripeProducts(productsData);

      // Load Stripe customers
      try {
        const response = await base44.functions.invoke('listStripeCustomers', {});
        if (response.data?.success) {
          setStripeCustomers(response.data.customers);
        } else {
          console.error("Failed to load Stripe customers:", response.data?.error);
        }
      } catch (error) {
        console.error("Error loading Stripe customers:", error);
      }
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBilled = async (entryId, currentStatus) => {
    const entryToUpdate = timeEntries.find(e => e.id === entryId);
    if (!entryToUpdate) return;

    await base44.entities.TimeEntry.update(entryId, { ...entryToUpdate, client_billed: !currentStatus });
    setTimeEntries(prevEntries =>
      prevEntries.map(e => e.id === entryId ? { ...e, client_billed: !currentStatus } : e)
    );
  };

  const handleTogglePaid = async (entryId, currentStatus) => {
    const entryToUpdate = timeEntries.find(e => e.id === entryId);
    if (!entryToUpdate) return;

    await base44.entities.TimeEntry.update(entryId, { ...entryToUpdate, contractor_paid: !currentStatus });
    setTimeEntries(prevEntries =>
      prevEntries.map(e => e.id === entryId ? { ...e, contractor_paid: !currentStatus } : e)
    );
  };

  const handleBulkMarkBilled = async (status) => {
    await Promise.all(
      selectedEntries.map(entryId => {
        const entry = filteredEntries.find(e => e.id === entryId);
        // Ensure entry exists before spreading it, to avoid errors if filteredEntries has changed
        return base44.entities.TimeEntry.update(entryId, { ...(entry || {}), client_billed: status });
      })
    );

    setTimeEntries(prevEntries =>
      prevEntries.map(e => selectedEntries.includes(e.id) ? { ...e, client_billed: status } : e)
    );
    setSelectedEntries([]);
  };

  const handleBulkMarkPaid = async (status) => {
    await Promise.all(
      selectedEntries.map(entryId => {
        const entry = filteredEntries.find(e => e.id === entryId);
        // Ensure entry exists before spreading it
        return base44.entities.TimeEntry.update(entryId, { ...(entry || {}), contractor_paid: status });
      })
    );

    setTimeEntries(prevEntries =>
      prevEntries.map(e => selectedEntries.includes(e.id) ? { ...e, contractor_paid: status } : e)
    );
    setSelectedEntries([]);
  };

  const handleBulkDelete = async () => {
    await Promise.all(
      selectedEntries.map(entryId => base44.entities.TimeEntry.delete(entryId))
    );

    setTimeEntries(prevEntries =>
      prevEntries.filter(e => !selectedEntries.includes(e.id))
    );
    setSelectedEntries([]);
    setShowDeleteDialog(false);
  };

  const openInvoiceDialog = () => {
    // Get selected time entries
    const selectedTimeEntries = filteredEntries.filter(e => selectedEntries.includes(e.id));

    // Group time entries by project and consolidate hours
    const projectGroups = {};
    selectedTimeEntries.forEach(entry => {
      const project = projects.find(p => p.id === entry.project_id);
      const projectId = entry.project_id;

      if (!projectGroups[projectId]) {
        projectGroups[projectId] = {
          project: project,
          totalHours: 0,
          entries: []
        };
      }

      projectGroups[projectId].totalHours += entry.hours || 0;
      projectGroups[projectId].entries.push(entry.id);
    });

    // Create consolidated line items (one per project)
    const consolidatedLineItems = Object.values(projectGroups).map(group => {
      const rate = group.project?.hourly_rate || 0; // Hourly rate is stored in dollars
      return {
        type: 'consolidated_time',
        time_entry_ids: group.entries, // Array of all time entry IDs
        description: `${group.project?.name || 'Project'} - Time & Materials`,
        hours: group.totalHours,
        rate: rate, // In dollars
        amount: group.totalHours * rate // In dollars
      };
    });

    // Try to auto-fill customer from first project's account
    let autoCustomerId = "";
    if (selectedTimeEntries.length > 0) {
      const firstProject = projects.find(p => p.id === selectedTimeEntries[0].project_id);
      if (firstProject?.account_id) {
        const billingContact = contacts.find(c => c.account_id === firstProject.account_id && c.role === 'billing');
        if (billingContact?.stripe_customer_id) {
          autoCustomerId = billingContact.stripe_customer_id;
        }
      }
    }

    setInvoiceData({
      customer_id: autoCustomerId,
      due_days: 30,
      notes: "",
      line_items: consolidatedLineItems,
      send_immediately: false // Default to draft to avoid spam
    });

    setShowInvoiceDialog(true);
  };

  const addProductLineItem = (productId, priceId) => {
    const product = stripeProducts.find(p => p.stripe_product_id === productId);
    const price = product?.prices?.find(p => p.id === priceId);

    if (!product || !price) return;

    const newItem = {
      type: 'product',
      product_id: productId,
      price_id: priceId,
      description: product.name,
      quantity: 1,
      rate: price.unit_amount / 100, // Stripe prices are in cents, convert to dollars
      amount: price.unit_amount / 100 // Stripe prices are in cents, convert to dollars
    };

    setInvoiceData(prev => ({
      ...prev,
      line_items: [...prev.line_items, newItem]
    }));
  };

  const addCustomLineItem = () => {
    const newItem = {
      type: 'custom',
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    };

    setInvoiceData(prev => ({
      ...prev,
      line_items: [...prev.line_items, newItem]
    }));
  };

  const updateLineItem = (index, field, value) => {
    const updatedItems = [...invoiceData.line_items];
    const item = updatedItems[index];

    // Update the field, converting to number if not description
    if (field === 'description') {
      item[field] = value;
    } else {
      item[field] = parseFloat(value) || 0;
    }

    // Recalculate amount based on the type
    if (item.type === 'consolidated_time') {
      item.amount = (item.hours || 0) * (item.rate || 0);
    } else if (item.type === 'product' || item.type === 'custom') {
      item.amount = (item.quantity || 0) * (item.rate || 0);
    }

    setInvoiceData(prev => ({ ...prev, line_items: updatedItems }));
  };

  const removeLineItem = (index) => {
    setInvoiceData(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index)
    }));
  };

  const handleSendInvoice = async () => {
    if (!invoiceData.customer_id) {
      alert("Please select a customer.");
      return;
    }

    if (invoiceData.line_items.length === 0) {
      alert("Please add at least one line item to the invoice.");
      return;
    }

    setInvoiceLoading(true);
    try {
      // Get all time entry IDs from consolidated time line items
      const allTimeEntryIds = invoiceData.line_items
        .filter(item => item.type === 'consolidated_time')
        .flatMap(item => item.time_entry_ids || []);

      // Get project IDs from time entries
      const projectIds = [...new Set(allTimeEntryIds.map(entryId => {
        const entry = filteredEntries.find(e => e.id === entryId);
        return entry?.project_id;
      }).filter(Boolean))];

      const firstProject = projectIds.length > 0 ? projects.find(p => p.id === projectIds[0]) : null;
      const accountId = firstProject?.account_id;

      if (!accountId) {
        alert("Could not determine an associated account for the invoice. Ensure selected time entries are linked to projects with accounts.");
        setInvoiceLoading(false);
        return;
      }

      // Calculate totals (these will be in dollars as stored in invoiceData.line_items)
      const subtotal = invoiceData.line_items.reduce((sum, item) => sum + (item.amount || 0), 0);
      const total = subtotal; // Add tax logic if needed

      // Create invoice record in your database
      const invoice = await base44.entities.Invoice.create({
        account_id: accountId,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + invoiceData.due_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'draft', // Initial status before sending to Stripe
        line_items: invoiceData.line_items, // Use the prepared line items (in dollars)
        subtotal: subtotal,
        total: total,
        notes: invoiceData.notes,
        time_entry_ids: allTimeEntryIds // Link all individual time entry IDs
      });

      // Log line items to debug
      console.log('Creating invoice with line items:', JSON.stringify(invoiceData.line_items, null, 2));

      // Create Stripe invoice using a serverless function
      // The serverless function 'createStripeInvoice' is responsible for fetching the invoice data
      // from the database (which includes line items in dollars) and converting them to cents for Stripe.
      const response = await base44.functions.invoke('createStripeInvoice', {
        invoiceId: invoice.id, // Pass the newly created database invoice ID
        stripeCustomerId: invoiceData.customer_id,
        sendInvoice: invoiceData.send_immediately // Pass the send option
      });

      if (response.data?.success) {
        // Mark all associated time entries as billed
        if (allTimeEntryIds.length > 0) {
          await Promise.all(
            allTimeEntryIds.map(entryId => {
              const entry = filteredEntries.find(e => e.id === entryId);
              if (entry) { // Ensure entry exists
                return base44.entities.TimeEntry.update(entryId, {
                  ...entry,
                  client_billed: true,
                  invoice_id: invoice.id // Link time entries to the invoice
                });
              }
              return Promise.resolve(); // If entry not found, resolve immediately
            })
          );

          // Update local state for time entries
          setTimeEntries(prevEntries =>
            prevEntries.map(e => allTimeEntryIds.includes(e.id) ? { ...e, client_billed: true, invoice_id: invoice.id } : e)
          );
        }

        // Open invoice in new tab
        if (response.data.hostedInvoiceUrl) {
          window.open(response.data.hostedInvoiceUrl, '_blank');
        }

        const statusMsg = invoiceData.send_immediately ? 'sent' : 'created as draft';
        alert(`Invoice ${statusMsg} successfully! Stripe Invoice ID: ${response.data.stripeInvoiceId}`);

        setSelectedEntries([]);
        setShowInvoiceDialog(false);
        setInvoiceData({ // Reset invoice data
          customer_id: "",
          due_days: 30,
          notes: "",
          line_items: [],
          send_immediately: false
        });
      } else {
        throw new Error(response.data?.error || 'Failed to create Stripe invoice. Please check Stripe connection and customer details.');
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
      alert(`Error creating invoice: ${error.message}`);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleBulkEdit = async () => {
    const updates = {};

    // Only include fields that have been set
    if (bulkEditData.project_id) updates.project_id = bulkEditData.project_id;
    if (bulkEditData.team_member_id) updates.team_member_id = bulkEditData.team_member_id;
    if (bulkEditData.billable !== "") updates.billable = bulkEditData.billable === "true";
    if (bulkEditData.client_billed !== "") updates.client_billed = bulkEditData.client_billed === "true";
    if (bulkEditData.contractor_paid !== "") updates.contractor_paid = bulkEditData.contractor_paid === "true";
    if (bulkEditData.description) updates.description = bulkEditData.description;

    if (Object.keys(updates).length === 0) return;

    await Promise.all(
      selectedEntries.map(entryId => {
        const entry = filteredEntries.find(e => e.id === entryId);
        // Ensure entry exists before spreading it
        return base44.entities.TimeEntry.update(entryId, { ...(entry || {}), ...updates });
      })
    );

    setTimeEntries(prevEntries =>
      prevEntries.map(e => selectedEntries.includes(e.id) ? { ...e, ...updates } : e)
    );

    setSelectedEntries([]);
    setShowBulkEdit(false);
    setBulkEditData({
      project_id: "",
      team_member_id: "",
      billable: "",
      client_billed: "",
      contractor_paid: "",
      description: ""
    });
  };

  const toggleEntrySelection = (entryId) => {
    setSelectedEntries(prev =>
      prev.includes(entryId)
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedEntries.length === filteredEntries.length && filteredEntries.length > 0) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(filteredEntries.map(e => e.id));
    }
  };

  const filterByDateRange = (date) => {
    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);

    if (!startDate && !endDate) return true;

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (entryDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (entryDate > end) return false;
    }
    return true;
  };

  const filteredEntries = timeEntries.filter(entry => {
    if (!filterByDateRange(entry.date)) return false;
    if (projectFilter !== "all" && entry.project_id !== projectFilter) return false;
    if (teamMemberFilter !== "all" && entry.team_member_id !== teamMemberFilter) return false;
    if (billingFilter === "billed" && !entry.client_billed) return false;
    if (billingFilter === "unbilled" && entry.client_billed) return false;
    if (paymentFilter === "paid" && !entry.contractor_paid) return false;
    if (paymentFilter === "unpaid" && entry.contractor_paid) return false;
    return true;
  });

  const isProjectBillableToClient = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return false;
    if (project.is_internal || project.billing_type === 'internal') return false;
    return true;
  };

  const getDaysInRange = () => {
    if (!startDate || !endDate) {
      // Default to a 30-day period if no dates are set for retainer calculation
      return 30;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end day
    return diffDays;
  };

  const getRetainerRevenue = () => {
    const daysInRange = getDaysInRange();
    const retainerProjects = new Set();

    filteredEntries.forEach(entry => {
      const project = projects.find(p => p.id === entry.project_id);
      if (project?.billing_type === 'retainer' && project.retainer_monthly) {
        retainerProjects.add(project.id);
      }
    });

    let totalRetainerRevenue = 0;
    retainerProjects.forEach(projectId => {
      const project = projects.find(p => p.id === projectId);
      if (project?.retainer_monthly) {
        // Prorate monthly retainer to daily rate and multiply by days in range
        const dailyRate = project.retainer_monthly / 30; // Assuming 30 days in a month for proration
        totalRetainerRevenue += dailyRate * daysInRange;
      }
    });

    return totalRetainerRevenue;
  };

  const totalHours = filteredEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  const billableHours = filteredEntries.filter(e => e.billable).reduce((sum, entry) => sum + (entry.hours || 0), 0);

  const hourlyRevenue = filteredEntries
    .filter(e => {
      const project = projects.find(p => p.id === e.project_id);
      return isProjectBillableToClient(e.project_id) && e.billable && project?.billing_type !== 'retainer';
    })
    .reduce((sum, entry) => {
      const project = projects.find(p => p.id === entry.project_id);
      const projectRate = project?.hourly_rate || 0;
      return sum + ((entry.hours || 0) * projectRate);
    }, 0);

  const retainerRevenue = getRetainerRevenue();
  const totalRevenue = hourlyRevenue + retainerRevenue;

  const totalPayroll = filteredEntries.reduce((sum, entry) => {
    const teamMember = teamMembers.find(tm => tm.id === entry.team_member_id);
    const memberRate = teamMember?.hourly_rate || 0;
    return sum + ((entry.hours || 0) * memberRate);
  }, 0);

  const billedRevenue = filteredEntries
    .filter(e => {
      const project = projects.find(p => p.id === e.project_id);
      return isProjectBillableToClient(e.project_id) && e.client_billed && e.billable && project?.billing_type !== 'retainer';
    })
    .reduce((sum, entry) => {
      const project = projects.find(p => p.id === entry.project_id);
      const projectRate = project?.hourly_rate || 0;
      return sum + ((entry.hours || 0) * projectRate);
    }, 0);

  const unbilledRevenue = filteredEntries
    .filter(e => {
      const project = projects.find(p => p.id === e.project_id);
      return isProjectBillableToClient(e.project_id) && !e.client_billed && e.billable && project?.billing_type !== 'retainer';
    })
    .reduce((sum, entry) => {
      const project = projects.find(p => p.id === entry.project_id);
      const projectRate = project?.hourly_rate || 0;
      return sum + ((entry.hours || 0) * projectRate);
    }, 0);

  const paidPayroll = filteredEntries
    .filter(e => e.contractor_paid)
    .reduce((sum, entry) => {
      const teamMember = teamMembers.find(tm => tm.id === entry.team_member_id);
      const memberRate = teamMember?.hourly_rate || 0;
      return sum + ((entry.hours || 0) * memberRate);
    }, 0);

  const unpaidPayroll = filteredEntries
    .filter(e => !e.contractor_paid)
    .reduce((sum, entry) => {
      const teamMember = teamMembers.find(tm => tm.id === entry.team_member_id);
      const memberRate = teamMember?.hourly_rate || 0;
      return sum + ((entry.hours || 0) * memberRate);
    }, 0);

  const profit = totalRevenue - totalPayroll;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const isAdmin = currentUser?.role === "admin";

  const getProjectName = (projectId) => {
    return projects.find(p => p.id === projectId)?.name || "Unknown";
  };

  const getTeamMemberName = (teamMemberId) => {
    const member = teamMembers.find(tm => tm.id === teamMemberId);
    return member?.full_name || "Unknown";
  };

  const resetFilters = () => {
    setProjectFilter("all");
    setTeamMemberFilter("all");
    setBillingFilter("all");
    setPaymentFilter("all");
    setStartDate("");
    setEndDate("");
    setSelectedEntries([]);
  };

  // Calculate total for invoice dialog dynamically
  const invoiceTotal = invoiceData.line_items.reduce((sum, item) => sum + (item.amount || 0), 0);

  // Re-added hasUnbilledSelectedEntries for button disabling logic
  const hasUnbilledSelectedEntries = selectedEntries.some(id => {
    const entry = filteredEntries.find(e => e.id === id);
    const project = projects.find(p => p.id === entry?.project_id);
    return entry && entry.billable && !entry.client_billed && isProjectBillableToClient(project?.id);
  });


  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Access Required</h2>
          <p className="text-gray-600">You need administrator privileges to view reports.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-8">
          <div className="h-12 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Financial Reports</h1>
        <p className="text-gray-500 mt-1">Filter and manage billing & payroll</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filters</CardTitle>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Reset All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Date Range Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Other Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Team Member</Label>
                <Select value={teamMemberFilter} onValueChange={setTeamMemberFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Team Members</SelectItem>
                    {teamMembers.filter(tm => tm.status === 'active').map(tm => (
                      <SelectItem key={tm.id} value={tm.id}>
                        {tm.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Client Billing</Label>
                <Select value={billingFilter} onValueChange={setBillingFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="billed">Billed</SelectItem>
                    <SelectItem value="unbilled">Unbilled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Contractor Payment</Label>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-gray-600">
              Showing {filteredEntries.length} of {timeEntries.length} time entries
              {(startDate || endDate) && (
                <span className="ml-2 text-indigo-600 font-medium">
                  {startDate && `from ${new Date(startDate + 'T00:00:00').toLocaleDateString()}`}
                  {startDate && endDate && ' '}
                  {endDate && `to ${new Date(endDate + 'T00:00:00').toLocaleDateString()}`}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics - Now based on filtered data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Total Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{totalHours.toFixed(1)}h</div>
            <p className="text-xs text-gray-500 mt-1">{billableHours.toFixed(1)}h billable</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Revenue
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Includes hourly billing + pro-rated retainers</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-gray-500 mt-1">
              {hourlyRevenue > 0 && retainerRevenue > 0
                ? `$${hourlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} hourly + $${retainerRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} retainer`
                : hourlyRevenue > 0
                ? 'From hourly billing'
                : retainerRevenue > 0
                ? 'From retainers'
                : 'No revenue'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Payroll Costs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">${totalPayroll.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-gray-500 mt-1">Team labor costs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Net Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${profit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-gray-500 mt-1">{profitMargin.toFixed(1)}% margin</p>
          </CardContent>
        </Card>
      </div>

      {/* Billing & Payment Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Client Billing Status
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Hourly billing only - retainers are pre-paid</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Unbilled (Hourly)</div>
                <div className="text-2xl font-bold text-orange-600">
                  ${unbilledRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Billed (Hourly)</div>
                <div className="text-2xl font-bold text-green-600">
                  ${billedRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            {retainerRevenue > 0 && (
              <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg">
                <div>
                  <div className="text-sm text-gray-600">Retainer Revenue</div>
                  <div className="text-2xl font-bold text-indigo-600">
                    ${retainerRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Pre-paid for this period</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contractor Payment Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Unpaid</div>
                <div className="text-2xl font-bold text-red-600">
                  ${unpaidPayroll.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Paid</div>
                <div className="text-2xl font-bold text-blue-600">
                  ${paidPayroll.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Time Entries */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Time Entry Details</CardTitle>
            {filteredEntries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                {selectedEntries.length === filteredEntries.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No time entries match your filters</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedEntries.length === filteredEntries.length && filteredEntries.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Billed</TableHead>
                  <TableHead>Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map(entry => {
                  const project = projects.find(p => p.id === entry.project_id);
                  const teamMember = teamMembers.find(tm => tm.id === entry.team_member_id);
                  const projectRate = project?.hourly_rate || 0;
                  const memberRate = teamMember?.hourly_rate || 0;
                  const isRetainer = project?.billing_type === 'retainer';
                  const canBillToClient = isProjectBillableToClient(entry.project_id) && !isRetainer;
                  const revenue = (entry.billable && canBillToClient) ? (entry.hours || 0) * projectRate : 0;
                  const cost = (entry.hours || 0) * memberRate;

                  return (
                    <TableRow key={entry.id} className="hover:bg-gray-50">
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedEntries.includes(entry.id)}
                          onCheckedChange={() => toggleEntrySelection(entry.id)}
                        />
                      </TableCell>
                      <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getProjectName(entry.project_id)}
                          {isRetainer && (
                            <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                              Retainer
                            </Badge>
                          )}
                          {project?.is_internal && (
                            <Badge variant="outline" className="text-xs">
                              Internal
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getTeamMemberName(entry.team_member_id)}</TableCell>
                      <TableCell className="font-medium">{entry.hours}h</TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {isRetainer ? (
                          <span className="text-xs text-gray-500">Retainer</span>
                        ) : revenue > 0 ? (
                          `$${revenue.toFixed(0)}`
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-red-600">
                        ${cost.toFixed(0)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {isRetainer ? (
                          <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700">
                            Pre-paid
                          </Badge>
                        ) : canBillToClient ? (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={entry.client_billed}
                              onCheckedChange={() => handleToggleBilled(entry.id, entry.client_billed)}
                              id={`billed-${entry.id}`}
                            />
                            <Label
                              htmlFor={`billed-${entry.id}`}
                              className={`cursor-pointer text-xs font-semibold px-2.5 py-0.5 rounded-full ${entry.client_billed ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}
                            >
                              {entry.client_billed ? "✓ Billed" : "Unbilled"}
                            </Label>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={entry.contractor_paid}
                            onCheckedChange={() => handleTogglePaid(entry.id, entry.contractor_paid)}
                            id={`paid-${entry.id}`}
                          />
                          <Label
                            htmlFor={`paid-${entry.id}`}
                            className={`cursor-pointer text-xs font-semibold px-2.5 py-0.5 rounded-full ${entry.contractor_paid ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}
                          >
                            {entry.contractor_paid ? "✓ Paid" : "Unpaid"}
                          </Label>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Floating Bulk Actions Bar */}
      {selectedEntries.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <Card className="shadow-2xl border-2 border-indigo-200 bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-indigo-600" />
                  <span className="font-semibold text-gray-900">{selectedEntries.length} selected</span>
                </div>
                <div className="h-6 w-px bg-gray-300" />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => setShowBulkEdit(true)} variant="outline" className="border-indigo-600 text-indigo-600 hover:bg-indigo-50">
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit All
                  </Button>
                  <Button size="sm" onClick={() => handleBulkMarkBilled(true)} className="bg-green-600 hover:bg-green-700">
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Mark Billed
                  </Button>
                  <Button size="sm" onClick={() => handleBulkMarkPaid(true)} className="bg-blue-600 hover:bg-blue-700">
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Mark Paid
                  </Button>
                  <Button
                    size="sm"
                    onClick={openInvoiceDialog}
                    className="bg-indigo-600 hover:bg-indigo-700"
                    disabled={!hasUnbilledSelectedEntries && invoiceData.line_items.length === 0}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Send Invoice
                  </Button>
                  <Button size="sm" onClick={() => setShowDeleteDialog(true)} variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                  <Button size="sm" onClick={() => setSelectedEntries([])} variant="ghost">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoice Dialog - Modified for editable consolidated line items */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Stripe Invoice</DialogTitle>
            <DialogDescription>
              Customize line items and create invoice in Stripe
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label>Stripe Customer <span className="text-red-500">*</span></Label>
              <Select
                value={invoiceData.customer_id}
                onValueChange={(value) => setInvoiceData(prev => ({...prev, customer_id: value}))}
                disabled={invoiceLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer to bill" />
                </SelectTrigger>
                <SelectContent>
                  {stripeCustomers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} {customer.email && `(${customer.email})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {stripeCustomers.length === 0 ? "No Stripe customers found. Create customers in Stripe first." : `${stripeCustomers.length} customers available`}
              </p>
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <div className="flex gap-2">
                  {/* Add Product Line Item */}
                  <Select
                      onValueChange={(productId) => {
                          const product = stripeProducts.find(p => p.stripe_product_id === productId);
                          if (product && product.prices && product.prices.length > 0) {
                              addProductLineItem(productId, product.prices[0].id); // Use the first price by default
                          }
                      }}
                      value="" // Reset after selection to allow re-selection
                      disabled={invoiceLoading}
                  >
                      <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Add Product" />
                      </SelectTrigger>
                      <SelectContent>
                          {stripeProducts.map(product => (
                              <SelectItem key={product.stripe_product_id} value={product.stripe_product_id}>
                                  {product.name}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCustomLineItem}
                    disabled={invoiceLoading}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Custom Item
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                {invoiceData.line_items.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No line items yet. Add custom items or select time entries to invoice.</p>
                  </div>
                ) : (
                  invoiceData.line_items.map((item, index) => (
                    <div key={index} className="p-3 hover:bg-gray-50">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                          {/* Description - Editable for all types */}
                          <Input
                            value={item.description}
                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                            placeholder="Description"
                            className="text-sm font-medium"
                            disabled={invoiceLoading}
                          />

                          {/* Hours/Rate/Amount Row - Editable */}
                          <div className="grid grid-cols-3 gap-2">
                            {item.type === 'consolidated_time' ? (
                              <>
                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-500">Hours</Label>
                                  <Input
                                    type="number"
                                    step="0.25"
                                    value={item.hours}
                                    onChange={(e) => updateLineItem(index, 'hours', e.target.value)}
                                    placeholder="Hours"
                                    className="text-sm"
                                    disabled={invoiceLoading}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-500">Rate/Hour</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={item.rate}
                                    onChange={(e) => updateLineItem(index, 'rate', e.target.value)}
                                    placeholder="Rate"
                                    className="text-sm"
                                    disabled={invoiceLoading}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-500">Amount</Label>
                                  <div className="flex items-center px-3 py-2 bg-gray-50 rounded text-sm font-semibold">
                                    ${item.amount.toFixed(2)}
                                  </div>
                                </div>
                              </>
                            ) : ( // For 'product' or 'custom' types
                              <>
                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-500">Quantity</Label>
                                  <Input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                                    placeholder="Qty"
                                    className="text-sm"
                                    disabled={invoiceLoading}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-500">Rate</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={item.rate}
                                    onChange={(e) => updateLineItem(index, 'rate', e.target.value)}
                                    placeholder="Rate"
                                    className="text-sm"
                                    disabled={invoiceLoading}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-500">Amount</Label>
                                  <div className="flex items-center px-3 py-2 bg-gray-50 rounded text-sm font-semibold">
                                    ${item.amount.toFixed(2)}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(index)}
                          disabled={invoiceLoading}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Invoice Total */}
              <div className="flex justify-end pt-3 border-t">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Invoice Total</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    ${invoiceTotal.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Terms */}
            <div className="space-y-2">
              <Label>Payment Terms</Label>
              <Select
                value={invoiceData.due_days.toString()}
                onValueChange={(value) => setInvoiceData(prev => ({...prev, due_days: parseInt(value)}))}
                disabled={invoiceLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Due in 7 days</SelectItem>
                  <SelectItem value="14">Due in 14 days</SelectItem>
                  <SelectItem value="30">Due in 30 days (Net 30)</SelectItem>
                  <SelectItem value="60">Due in 60 days (Net 60)</SelectItem>
                  <SelectItem value="90">Due in 90 days (Net 90)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Send Option */}
            <div className="space-y-2">
              <Label>Delivery Method</Label>
              <Select
                value={invoiceData.send_immediately.toString()}
                onValueChange={(value) => setInvoiceData(prev => ({...prev, send_immediately: value === 'true'}))}
                disabled={invoiceLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Save as Draft (Don't Send)</SelectItem>
                  <SelectItem value="true">Send Invoice Immediately</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {invoiceData.send_immediately
                  ? "⚠️ Invoice will be emailed to customer immediately"
                  : "✓ Invoice will be saved as draft in Stripe for review"}
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Invoice Notes (Optional)</Label>
              <Textarea
                value={invoiceData.notes}
                onChange={(e) => setInvoiceData(prev => ({...prev, notes: e.target.value}))}
                placeholder="Add any notes or payment instructions..."
                rows={3}
                disabled={invoiceLoading}
              />
            </div>

            {/* Info Alert */}
            <div className={`${invoiceData.send_immediately ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4`}>
              <div className="flex gap-3">
                <Info className={`w-5 h-5 ${invoiceData.send_immediately ? 'text-orange-600' : 'text-blue-600'} flex-shrink-0 mt-0.5`} />
                <div className={`text-sm ${invoiceData.send_immediately ? 'text-orange-800' : 'text-blue-800'}`}>
                  <p className="font-semibold mb-1">
                    {invoiceData.send_immediately ? "Invoice will be sent immediately:" : "Draft invoice will be created:"}
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Invoice will be created in your Stripe account</li>
                    {invoiceData.send_immediately ? (
                      <>
                        <li>⚠️ Email will be sent to customer automatically</li>
                        <li>Time entries will be marked as "Billed"</li>
                      </>
                    ) : (
                      <>
                        <li>✓ No email will be sent yet</li>
                        <li>You can review and edit in Stripe before sending</li>
                        <li>Time entries will be marked as "Billed"</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceDialog(false)} disabled={invoiceLoading}>
              Cancel
            </Button>
            <Button onClick={handleSendInvoice} disabled={invoiceLoading || !invoiceData.customer_id || invoiceData.line_items.length === 0} className="bg-indigo-600 hover:bg-indigo-700">
              {invoiceLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  {invoiceData.send_immediately ? 'Create & Send Invoice' : 'Create Draft Invoice'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Drawer */}
      <Sheet open={showBulkEdit} onOpenChange={setShowBulkEdit}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Bulk Edit {selectedEntries.length} Time Entries</SheetTitle>
            <SheetDescription>
              Change multiple fields at once. Leave fields blank to keep existing values.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={bulkEditData.project_id} onValueChange={(value) => setBulkEditData(prev => ({...prev, project_id: value}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Keep current" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Keep current</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Team Member</Label>
              <Select value={bulkEditData.team_member_id} onValueChange={(value) => setBulkEditData(prev => ({...prev, team_member_id: value}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Keep current" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Keep current</SelectItem>
                  {teamMembers.filter(tm => tm.status === 'active').map(tm => (
                    <SelectItem key={tm.id} value={tm.id}>
                      {tm.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Billable</Label>
              <Select value={bulkEditData.billable} onValueChange={(value) => setBulkEditData(prev => ({...prev, billable: value}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Keep current" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Keep current</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Client Billed</Label>
              <Select value={bulkEditData.client_billed} onValueChange={(value) => setBulkEditData(prev => ({...prev, client_billed: value}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Keep current" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Keep current</SelectItem>
                  <SelectItem value="true">Billed</SelectItem>
                  <SelectItem value="false">Unbilled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Contractor Paid</Label>
              <Select value={bulkEditData.contractor_paid} onValueChange={(value) => setBulkEditData(prev => ({...prev, contractor_paid: value}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Keep current" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Keep current</SelectItem>
                  <SelectItem value="true">Paid</SelectItem>
                  <SelectItem value="false">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={bulkEditData.description}
                onChange={(e) => setBulkEditData(prev => ({...prev, description: e.target.value}))}
                placeholder="Leave empty to keep existing descriptions"
                rows={3}
              />
              <p className="text-xs text-gray-500">Will replace existing descriptions if provided</p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBulkEdit(false);
                  setBulkEditData({
                    project_id: "",
                    team_member_id: "",
                    billable: "",
                    client_billed: "",
                    contractor_paid: "",
                    description: ""
                  });
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleBulkEdit} className="bg-indigo-600 hover:bg-indigo-700">
                <CheckSquare className="w-4 h-4 mr-2" />
                Apply Changes
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedEntries.length} Time Entries?</DialogTitle>
            <DialogDescription>
              This will permanently delete the selected time entries. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete {selectedEntries.length} Entries
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
