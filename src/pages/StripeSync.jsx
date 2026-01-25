
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Package, CreditCard, Users, CheckCircle, XCircle, Link2, X, FileText, Edit, Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";

export default function StripeSync() {
  const [products, setProducts] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [stripeCustomers, setStripeCustomers] = useState([]);
  const [stripeSubscriptions, setStripeSubscriptions] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncingCustomers, setSyncingCustomers] = useState(false);
  const [syncingSubscriptions, setSyncingSubscriptions] = useState(false);
  const [syncResults, setSyncResults] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Link dialogs
  const [linkCustomerDialog, setLinkCustomerDialog] = useState({ open: false, customer: null });
  const [linkSubscriptionDialog, setLinkSubscriptionDialog] = useState({ open: false, subscription: null });
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  
  // Invoice dialogs
  const [showInvoiceDrawer, setShowInvoiceDrawer] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [deleteInvoiceDialog, setDeleteInvoiceDialog] = useState({ open: false, invoiceId: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [currentUser, productsData, subscriptionsData, accountsData, projectsData, contactsData, invoicesData] = await Promise.all([
        base44.auth.me(),
        base44.entities.StripeProduct.list(),
        base44.entities.StripeSubscription.list("-created_date"),
        base44.entities.Account.list(),
        base44.entities.Project.list(),
        base44.entities.Contact.list(),
        base44.entities.Invoice.list("-created_date")
      ]);

      setUser(currentUser);
      
      if (currentUser.role === "admin") {
        setProducts(productsData);
        setSubscriptions(subscriptionsData);
        setAccounts(accountsData);
        setProjects(projectsData);
        setContacts(contactsData);
        setInvoices(invoicesData);
        
        // Auto-load customers and subscriptions
        loadStripeCustomers();
        loadStripeSubscriptions();
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStripeCustomers = async () => {
    setSyncingCustomers(true);
    try {
      const response = await base44.functions.invoke('listStripeCustomers', {});
      if (response.data?.success) {
        setStripeCustomers(response.data.customers);
      }
    } catch (error) {
      console.error('Error loading Stripe customers:', error);
    } finally {
      setSyncingCustomers(false);
    }
  };

  const loadStripeSubscriptions = async () => {
    setSyncingSubscriptions(true);
    try {
      const response = await base44.functions.invoke('listStripeSubscriptions', {});
      if (response.data?.success) {
        setStripeSubscriptions(response.data.subscriptions);
      }
    } catch (error) {
      console.error('Error loading Stripe subscriptions:', error);
    } finally {
      setSyncingSubscriptions(false);
    }
  };

  const handleSync = async (syncType = 'all') => {
    setSyncing(true);
    setSyncResults(null);
    try {
      const response = await base44.functions.invoke('syncStripeData', { syncType });
      if (response.data?.success) {
        setSyncResults(response.data.results);
        await loadData();
      }
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Failed to sync Stripe data: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleLinkCustomer = async () => {
    if (!selectedContactId || !linkCustomerDialog.customer) return;

    try {
      const contact = contacts.find(c => c.id === selectedContactId);
      if (!contact) return;

      await base44.entities.Contact.update(selectedContactId, {
        ...contact,
        stripe_customer_id: linkCustomerDialog.customer.id
      });

      alert('Customer linked successfully!');
      setLinkCustomerDialog({ open: false, customer: null });
      setSelectedContactId("");
      
      await loadData();
    } catch (error) {
      console.error('Error linking customer:', error);
      alert('Failed to link customer: ' + error.message);
    }
  };

  const handleUnlinkCustomer = async (customerId) => {
    const contact = contacts.find(c => c.stripe_customer_id === customerId);
    if (!contact) return;

    if (!confirm('Are you sure you want to unlink this customer?')) return;

    try {
      await base44.entities.Contact.update(contact.id, {
        ...contact,
        stripe_customer_id: null
      });

      alert('Customer unlinked successfully!');
      await loadData();
    } catch (error) {
      console.error('Error unlinking customer:', error);
      alert('Failed to unlink customer: ' + error.message);
    }
  };

  const handleLinkSubscription = async () => {
    if (!selectedProjectId || !linkSubscriptionDialog.subscription) return;

    try {
      const dbSubscription = subscriptions.find(s => s.stripe_subscription_id === linkSubscriptionDialog.subscription.id);
      if (!dbSubscription) {
        alert('Subscription not found in database. Please sync subscriptions first.');
        return;
      }

      await base44.entities.StripeSubscription.update(dbSubscription.id, {
        ...dbSubscription,
        project_id: selectedProjectId
      });

      alert('Subscription linked successfully!');
      setLinkSubscriptionDialog({ open: false, subscription: null });
      setSelectedProjectId("");
      
      await loadData();
    } catch (error) {
      console.error('Error linking subscription:', error);
      alert('Failed to link subscription: ' + error.message);
    }
  };

  const handleUnlinkSubscription = async (subscriptionId) => {
    const subscription = subscriptions.find(s => s.stripe_subscription_id === subscriptionId);
    if (!subscription) return;

    if (!confirm('Are you sure you want to unlink this subscription?')) return;

    try {
      await base44.entities.StripeSubscription.update(subscription.id, {
        ...subscription,
        project_id: null
      });

      alert('Subscription unlinked successfully!');
      await loadData();
    } catch (error) {
      console.error('Error unlinking subscription:', error);
      alert('Failed to unlink subscription: ' + error.message);
    }
  };

  const handleSaveInvoice = async (invoiceData) => {
    try {
      if (editingInvoice) {
        await base44.entities.Invoice.update(editingInvoice.id, invoiceData);
      } else {
        await base44.entities.Invoice.create(invoiceData);
      }
      setShowInvoiceDrawer(false);
      setEditingInvoice(null);
      await loadData();
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Failed to save invoice: ' + error.message);
    }
  };

  const handleDeleteInvoice = async () => {
    try {
      await base44.entities.Invoice.delete(deleteInvoiceDialog.invoiceId);
      setDeleteInvoiceDialog({ open: false, invoiceId: null });
      await loadData();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Failed to delete invoice: ' + error.message);
    }
  };

  const isCustomerLinked = (stripeCustomerId) => {
    return contacts.some(c => c.stripe_customer_id === stripeCustomerId);
  };

  const getLinkedContact = (stripeCustomerId) => {
    return contacts.find(c => c.stripe_customer_id === stripeCustomerId);
  };

  const isSubscriptionLinked = (stripeSubscriptionId) => {
    return subscriptions.some(s => s.stripe_subscription_id === stripeSubscriptionId && s.project_id);
  };

  const getLinkedProject = (stripeSubscriptionId) => {
    const subscription = subscriptions.find(s => s.stripe_subscription_id === stripeSubscriptionId);
    if (!subscription?.project_id) return null;
    return projects.find(p => p.id === subscription.project_id);
  };

  const statusColors = {
    active: "bg-green-100 text-green-800",
    past_due: "bg-yellow-100 text-yellow-800",
    unpaid: "bg-red-100 text-red-800",
    canceled: "bg-gray-100 text-gray-800",
    incomplete: "bg-orange-100 text-orange-800",
    trialing: "bg-blue-100 text-blue-800",
    paused: "bg-gray-100 text-gray-800",
    draft: "bg-gray-100 text-gray-800",
    sent: "bg-blue-100 text-blue-800",
    paid: "bg-green-100 text-green-800",
    overdue: "bg-red-100 text-red-800",
    cancelled: "bg-gray-100 text-gray-800",
  };

  if (!loading && user?.role !== "admin") {
    return (
      <div className="p-6 lg:p-8">
        <Alert variant="destructive">
          <AlertDescription>
            You don't have permission to view this page. Only administrators can access Stripe sync.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stripe Integration</h1>
          <p className="text-gray-500 mt-1">Sync products, subscriptions, and customers from Stripe</p>
        </div>
        <Button 
          onClick={() => handleSync('all')}
          disabled={syncing}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync All'}
        </Button>
      </div>

      {syncResults && (
        <Alert className="mb-6">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Sync completed! Products: {syncResults.products}, Subscriptions: {syncResults.subscriptions}, Transactions: {syncResults.transactions}, Invoices: {syncResults.invoices}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{products.length}</div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => handleSync('products')}
              disabled={syncing}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stripeSubscriptions.length}</div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={loadStripeSubscriptions}
              disabled={syncingSubscriptions}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${syncingSubscriptions ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Stripe Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stripeCustomers.length}</div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={loadStripeCustomers}
              disabled={syncingCustomers}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${syncingCustomers ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{invoices.length}</div>
            <p className="text-xs text-gray-500 mt-1">In database</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="customers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle>Stripe Customers</CardTitle>
            </CardHeader>
            <CardContent>
              {syncingCustomers && stripeCustomers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                  Loading customers...
                </div>
              ) : stripeCustomers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No customers found</h3>
                  <p className="text-gray-500">Click Refresh to load from Stripe</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Stripe ID</TableHead>
                      <TableHead>Link Status</TableHead>
                      <TableHead>Linked Contact</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stripeCustomers.map((customer) => {
                      const linked = isCustomerLinked(customer.id);
                      const contact = getLinkedContact(customer.id);
                      const account = contact ? accounts.find(a => a.id === contact.account_id) : null;
                      
                      return (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">{customer.name || '—'}</TableCell>
                          <TableCell>{customer.email || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{customer.id}</TableCell>
                          <TableCell>
                            {linked ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-sm">Linked</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-gray-400">
                                <XCircle className="w-4 h-4" />
                                <span className="text-sm">Not Linked</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {contact ? (
                              <div>
                                <p className="font-medium">{contact.first_name} {contact.last_name}</p>
                                {account && (
                                  <p className="text-xs text-gray-500">{account.company_name}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {linked ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnlinkCustomer(customer.id)}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Unlink
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setLinkCustomerDialog({ open: true, customer })}
                              >
                                <Link2 className="w-4 h-4 mr-1" />
                                Link
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle>Stripe Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              {syncingSubscriptions && stripeSubscriptions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                  Loading subscriptions...
                </div>
              ) : stripeSubscriptions.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No subscriptions found</h3>
                  <p className="text-gray-500">Click Refresh to load from Stripe</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Interval</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Link Status</TableHead>
                      <TableHead>Linked Project</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stripeSubscriptions.map((sub) => {
                      const linked = isSubscriptionLinked(sub.id);
                      const project = getLinkedProject(sub.id);
                      
                      return (
                        <TableRow key={sub.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{sub.customer_name || '—'}</p>
                              {sub.customer_email && (
                                <p className="text-xs text-gray-500">{sub.customer_email}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{sub.product_name}</TableCell>
                          <TableCell>
                            ${((sub.items?.data?.[0]?.price?.unit_amount || 0) / 100).toFixed(2)} {(sub.currency || 'usd').toUpperCase()}
                          </TableCell>
                          <TableCell className="capitalize">
                            {sub.items?.data?.[0]?.price?.recurring?.interval || 'month'}ly
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[sub.status] || "bg-gray-100 text-gray-800"}>
                              {sub.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {linked ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-sm">Linked</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-gray-400">
                                <XCircle className="w-4 h-4" />
                                <span className="text-sm">Not Linked</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {project ? (
                              <p className="font-medium">{project.name}</p>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {linked ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnlinkSubscription(sub.id)}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Unlink
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setLinkSubscriptionDialog({ open: true, subscription: sub })}
                              >
                                <Link2 className="w-4 h-4 mr-1" />
                                Link
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* New Invoices Tab */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Invoices</CardTitle>
              <Button
                onClick={() => {
                  setEditingInvoice(null);
                  setShowInvoiceDrawer(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Invoice
              </Button>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No invoices</h3>
                  <p className="text-gray-500">Create your first invoice or sync from Stripe</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => {
                      const account = accounts.find(a => a.id === invoice.account_id);
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-mono text-sm">
                            {invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}
                          </TableCell>
                          <TableCell>{account?.company_name || '—'}</TableCell>
                          <TableCell>{new Date(invoice.issue_date).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-semibold">
                            ${(invoice.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[invoice.status]}>
                              {invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingInvoice(invoice);
                                  setShowInvoiceDrawer(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteInvoiceDialog({ open: true, invoiceId: invoice.id })}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
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
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Stripe Products</CardTitle>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No products</h3>
                  <p className="text-gray-500">Click "Sync All" to import from Stripe</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Prices</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          <Badge variant={product.active ? "default" : "secondary"}>
                            {product.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <p className="text-sm text-gray-600 truncate">{product.description || '—'}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {product.prices?.slice(0, 3).map((price, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                ${price.unit_amount} {price.currency.toUpperCase()}
                                {price.recurring && ` / ${price.recurring.interval}`}
                              </Badge>
                            ))}
                            {product.prices?.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{product.prices.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Link Customer Dialog */}
      <Dialog open={linkCustomerDialog.open} onOpenChange={(open) => setLinkCustomerDialog({ ...linkCustomerDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Stripe Customer</DialogTitle>
            <DialogDescription>
              Link "{linkCustomerDialog.customer?.name || linkCustomerDialog.customer?.email}" to a contact in your system
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Contact</Label>
              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts
                    .filter(c => !c.stripe_customer_id)
                    .map(contact => {
                      const account = accounts.find(a => a.id === contact.account_id);
                      return (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.first_name} {contact.last_name} ({contact.email})
                          {account && ` - ${account.company_name}`}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                This will link the Stripe customer to the selected contact record
              </p>
            </div>

            {linkCustomerDialog.customer && (
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <p className="font-semibold mb-1">Stripe Customer Details:</p>
                <p className="text-gray-600">Name: {linkCustomerDialog.customer.name || '—'}</p>
                <p className="text-gray-600">Email: {linkCustomerDialog.customer.email || '—'}</p>
                <p className="text-gray-600 font-mono text-xs">ID: {linkCustomerDialog.customer.id}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setLinkCustomerDialog({ open: false, customer: null });
              setSelectedContactId("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleLinkCustomer} disabled={!selectedContactId}>
              <Link2 className="w-4 h-4 mr-2" />
              Link Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Subscription Dialog */}
      <Dialog open={linkSubscriptionDialog.open} onOpenChange={(open) => setLinkSubscriptionDialog({ ...linkSubscriptionDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Stripe Subscription</DialogTitle>
            <DialogDescription>
              Link this subscription to a project in your system
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => {
                    const account = accounts.find(a => a.id === project.account_id);
                    return (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} {account && `(${account.company_name})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                This will associate the subscription with the selected project
              </p>
            </div>

            {linkSubscriptionDialog.subscription && (
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <p className="font-semibold mb-1">Subscription Details:</p>
                <p className="text-gray-600">Customer: {linkSubscriptionDialog.subscription.customer_name || linkSubscriptionDialog.subscription.customer_email || '—'}</p>
                <p className="text-gray-600">Product: {linkSubscriptionDialog.subscription.product_name}</p>
                <p className="text-gray-600">
                  Amount: ${((linkSubscriptionDialog.subscription.items?.data?.[0]?.price?.unit_amount || 0) / 100).toFixed(2)} {(linkSubscriptionDialog.subscription.currency || 'usd').toUpperCase()}
                </p>
                <p className="text-gray-600">Status: {linkSubscriptionDialog.subscription.status}</p>
                <p className="text-gray-600 font-mono text-xs">ID: {linkSubscriptionDialog.subscription.id}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setLinkSubscriptionDialog({ open: false, subscription: null });
              setSelectedProjectId("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleLinkSubscription} disabled={!selectedProjectId}>
              <Link2 className="w-4 h-4 mr-2" />
              Link Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Drawer */}
      <Sheet open={showInvoiceDrawer} onOpenChange={setShowInvoiceDrawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingInvoice ? 'Edit Invoice' : 'New Invoice'}</SheetTitle>
            <SheetDescription>
              {editingInvoice ? 'Update invoice details' : 'Create a new invoice'}
            </SheetDescription>
          </SheetHeader>
          <InvoiceForm
            invoice={editingInvoice}
            accounts={accounts}
            projects={projects}
            onSubmit={handleSaveInvoice}
            onCancel={() => {
              setShowInvoiceDrawer(false);
              setEditingInvoice(null);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Delete Invoice Dialog */}
      <Dialog open={deleteInvoiceDialog.open} onOpenChange={(open) => setDeleteInvoiceDialog({ ...deleteInvoiceDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteInvoiceDialog({ open: false, invoiceId: null })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteInvoice}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Invoice Form Component
function InvoiceForm({ invoice, accounts, projects, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(invoice ? {
    ...invoice,
    issue_date: invoice.issue_date ? new Date(invoice.issue_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    due_date: invoice.due_date ? new Date(invoice.due_date).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    project_id: invoice.project_id || "" // Ensure project_id is empty string for Select 'None' option
  } : {
    invoice_number: '',
    account_id: '',
    project_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'draft',
    line_items: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simplified total calculation as line items are not fully managed in this form
    const calculatedSubtotal = formData.line_items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const calculatedTotal = calculatedSubtotal + (formData.tax || 0);

    // Filter out empty project_id to store as null
    const dataToSubmit = {
      ...formData,
      project_id: formData.project_id === "" ? null : formData.project_id,
      subtotal: calculatedSubtotal,
      total: calculatedTotal
    };

    onSubmit(dataToSubmit);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 mt-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="invoice_number">Invoice Number</Label>
          <Input
            id="invoice_number"
            value={formData.invoice_number}
            onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
            placeholder="INV-001"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status *</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger id="status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="account_id">Account *</Label>
        <Select value={formData.account_id} onValueChange={(value) => setFormData({ ...formData, account_id: value })} required>
          <SelectTrigger id="account_id">
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map(account => (
              <SelectItem key={account.id} value={account.id}>
                {account.company_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="project_id">Project (Optional)</Label>
        <Select value={formData.project_id} onValueChange={(value) => setFormData({ ...formData, project_id: value })}>
          <SelectTrigger id="project_id">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>None</SelectItem> {/* Use empty string for null */}
            {projects.map(project => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="issue_date">Issue Date *</Label>
          <Input
            id="issue_date"
            type="date"
            value={formData.issue_date}
            onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="due_date">Due Date *</Label>
          <Input
            id="due_date"
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          placeholder="Invoice notes..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
          {invoice ? 'Update' : 'Create'} Invoice
        </Button>
      </div>
    </form>
  );
}
