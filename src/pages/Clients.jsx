
import React, { useState, useEffect } from "react";
import { Client } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Mail, Phone, Globe } from "lucide-react";
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
import ClientForm from "../components/clients/ClientForm";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    const data = await Client.list("-created_date");
    setClients(data);
    setLoading(false);
  };

  const handleSubmit = async (clientData) => {
    if (editingClient) {
      await Client.update(editingClient.id, clientData);
    } else {
      await Client.create(clientData);
    }
    setShowDrawer(false);
    setEditingClient(null);
    loadClients();
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setShowDrawer(true);
  };

  const statusColors = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    paused: "bg-yellow-100 text-yellow-800"
  };

  const riskColors = {
    low: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    high: "bg-red-100 text-red-700"
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 mt-1">Manage your client relationships</p>
        </div>
        <Button 
          onClick={() => {
            setEditingClient(null);
            setShowDrawer(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Retainer</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  No clients yet. Click "Add Client" to get started.
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow key={client.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{client.company_name}</TableCell>
                  <TableCell>{client.contact_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {client.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    {client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {client.phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[client.status]}>
                      {client.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={riskColors[client.risk_level || "low"]}>
                      {(client.risk_level || "low").toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {client.retainer_monthly ? (
                      <div>
                        <p className="font-semibold">${client.retainer_monthly.toLocaleString()}/mo</p>
                        {client.retainer_hours && (
                          <p className="text-xs text-gray-500">{client.retainer_hours}h included</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(client)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={showDrawer} onOpenChange={setShowDrawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingClient ? "Edit Client" : "Add New Client"}</SheetTitle>
            <SheetDescription>
              {editingClient ? "Update client information" : "Add a new client to your agency"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ClientForm
              client={editingClient}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowDrawer(false);
                setEditingClient(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
