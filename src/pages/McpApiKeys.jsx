import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  Loader2,
  Server,
  BookOpen,
  ChevronDown,
  Trash2,
  RefreshCw,
  ExternalLink,
  Terminal,
  Shield,
  Wrench,
  FileText,
  MessageSquare,
} from "lucide-react";

const MCP_BASE_URL = "https://ctfichbfoligaiabudjv.supabase.co/functions/v1/mcp-server";
const MCP_ENDPOINT = `${MCP_BASE_URL}/mcp`;

// --- Helpers ---

function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs gap-1">
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function CodeBlock({ children, copyText }) {
  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto font-mono">
        <code>{children}</code>
      </pre>
      {copyText && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={copyText} />
        </div>
      )}
    </div>
  );
}

async function hashApiKey(key) {
  const encoded = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateApiKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `mcp_${hex}`;
}

// --- Server Status Section ---

function ServerStatusCard({ serverInfo, loading, onRefresh }) {
  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        "harmon-digital-os": {
          url: MCP_ENDPOINT,
          headers: {
            "X-API-Key": "YOUR_API_KEY_HERE",
          },
        },
      },
    },
    null,
    2
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              MCP Server
            </CardTitle>
            <CardDescription>Model Context Protocol server status and connection details</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !serverInfo ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading server info...
          </div>
        ) : serverInfo ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Name</p>
                <p className="font-medium">{serverInfo.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Version</p>
                <p className="font-medium">{serverInfo.version}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Tools</p>
                <p className="font-medium">{serverInfo.tools}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Online</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Resources</p>
                <p className="font-medium">{serverInfo.resources}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Prompts</p>
                <p className="font-medium">{serverInfo.prompts}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500 uppercase tracking-wider">MCP Endpoint</p>
                <CopyButton text={MCP_ENDPOINT} />
              </div>
              <code className="text-sm bg-gray-100 px-3 py-1.5 rounded block font-mono">{MCP_ENDPOINT}</code>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Claude Desktop Config</p>
                <CopyButton text={claudeConfig} />
              </div>
              <CodeBlock copyText={claudeConfig}>{claudeConfig}</CodeBlock>
            </div>
          </>
        ) : (
          <div className="text-red-500 text-sm">Failed to load server info. The server may be down.</div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Documentation Section ---

function ToolCategory({ title, icon, tools }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-gray-50 transition-colors text-left">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
          <Badge variant="secondary" className="text-xs">{tools.length}</Badge>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 border-l-2 border-gray-100 pl-4 pb-2 space-y-1">
          {tools.map((tool) => (
            <div key={tool.name} className="py-1.5">
              <code className="text-xs font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{tool.name}</code>
              {tool.description && (
                <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DocumentationSection({ tools, resources, prompts, loadingTools }) {
  const [docsOpen, setDocsOpen] = useState(false);

  // Group tools by category
  const toolCategories = React.useMemo(() => {
    if (!tools.length) return [];

    const categories = {};
    for (const tool of tools) {
      // Determine category from tool name pattern
      let category = "Other";
      const name = tool.name;

      if (name.startsWith("list_") || name.startsWith("get_") || name.startsWith("create_") || name.startsWith("update_") || name.startsWith("delete_") || name.startsWith("search_")) {
        // Extract entity name
        const parts = name.split("_");
        const action = parts[0];
        const entity = parts.slice(1).join("_");
        category = `CRUD: ${entity.replace(/_/g, " ")}`;
      } else if (name.includes("kpi")) {
        category = "KPIs";
      } else if (name.includes("notification")) {
        category = "Notifications";
      } else if (name.includes("report")) {
        category = "Reports";
      }

      if (!categories[category]) categories[category] = [];
      categories[category].push(tool);
    }

    // Sort and group CRUD entities together
    const crudCategories = {};
    const specialCategories = {};

    for (const [cat, catTools] of Object.entries(categories)) {
      if (cat.startsWith("CRUD:")) {
        // Group all CRUD operations by entity
        const entity = cat.replace("CRUD: ", "");
        if (!crudCategories[entity]) crudCategories[entity] = [];
        crudCategories[entity].push(...catTools);
      } else {
        specialCategories[cat] = catTools;
      }
    }

    // Consolidate CRUD into single categories per entity
    const result = [];

    // Group CRUD tools by entity differently - look at the last part of the name
    const entityMap = {};
    for (const tool of tools) {
      const name = tool.name;
      const prefixes = ["list_", "get_", "create_", "update_", "delete_", "search_"];
      let matched = false;
      for (const prefix of prefixes) {
        if (name.startsWith(prefix)) {
          const entity = name.slice(prefix.length);
          if (!entityMap[entity]) entityMap[entity] = [];
          entityMap[entity].push(tool);
          matched = true;
          break;
        }
      }
      if (!matched) {
        const cat = name.includes("kpi") ? "KPIs" : name.includes("notification") ? "Notifications" : name.includes("report") ? "Reports" : "Other";
        if (!specialCategories[cat]) specialCategories[cat] = [];
        if (!specialCategories[cat].find((t) => t.name === tool.name)) {
          specialCategories[cat].push(tool);
        }
      }
    }

    // Add entity CRUD groups
    const sortedEntities = Object.keys(entityMap).sort();
    for (const entity of sortedEntities) {
      result.push({
        title: entity.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        tools: entityMap[entity],
      });
    }

    // Add special categories
    for (const [cat, catTools] of Object.entries(specialCategories)) {
      if (catTools.length > 0 && cat !== "Other") {
        result.push({ title: cat, tools: catTools });
      }
    }

    // Add "Other" last
    if (specialCategories.Other?.length) {
      result.push({ title: "Other", tools: specialCategories.Other });
    }

    return result;
  }, [tools]);

  const curlInit = `curl -X POST ${MCP_ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'`;

  const curlListTools = `curl -X POST ${MCP_ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'`;

  const curlCallTool = `curl -X POST ${MCP_ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_tasks","arguments":{"limit":5}}}'`;

  return (
    <Card>
      <Collapsible open={docsOpen} onOpenChange={setDocsOpen}>
        <CardHeader>
          <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Documentation
              </CardTitle>
              <CardDescription>Setup guide, available tools, and API reference</CardDescription>
            </div>
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${docsOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-8 pt-0">
            {/* Getting Started */}
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-lg mb-3">
                <Terminal className="w-5 h-5 text-indigo-600" />
                Getting Started
              </h3>
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-2">
                  <span className="font-bold text-indigo-600 shrink-0">1.</span>
                  <span>Create an API key below using the "Create Key" button.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-indigo-600 shrink-0">2.</span>
                  <span>
                    Copy the Claude Desktop config JSON from the Server Status card above and replace{" "}
                    <code className="bg-gray-100 px-1 rounded text-xs">YOUR_API_KEY_HERE</code> with your new key.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-indigo-600 shrink-0">3.</span>
                  <span>
                    Paste the config into your Claude Desktop settings file at{" "}
                    <code className="bg-gray-100 px-1 rounded text-xs">~/Library/Application Support/Claude/claude_desktop_config.json</code>
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-indigo-600 shrink-0">4.</span>
                  <span>Restart Claude Desktop. You should see the MCP tools available.</span>
                </li>
              </ol>

              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Test with curl:</p>
                <CodeBlock copyText={curlInit}>{curlInit}</CodeBlock>
                <CodeBlock copyText={curlListTools}>{curlListTools}</CodeBlock>
                <CodeBlock copyText={curlCallTool}>{curlCallTool}</CodeBlock>
              </div>
            </div>

            {/* Authentication */}
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-lg mb-3">
                <Shield className="w-5 h-5 text-indigo-600" />
                Authentication
              </h3>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <p className="font-medium">API Key Mode</p>
                  <p>
                    Pass <code className="bg-white px-1 rounded text-xs border">X-API-Key: your_key</code> header.
                    Uses the service role — full access, bypasses RLS. Best for Claude Desktop and automation.
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <p className="font-medium">JWT Mode</p>
                  <p>
                    Pass <code className="bg-white px-1 rounded text-xs border">Authorization: Bearer jwt_token</code> header.
                    User-scoped with RLS. Best for per-user access from the frontend.
                  </p>
                </div>
              </div>
            </div>

            {/* Available Tools */}
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-lg mb-3">
                <Wrench className="w-5 h-5 text-indigo-600" />
                Available Tools
                {tools.length > 0 && (
                  <Badge variant="secondary">{tools.length} tools</Badge>
                )}
              </h3>
              {loadingTools ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading tools from server...
                </div>
              ) : toolCategories.length > 0 ? (
                <div className="space-y-1 border rounded-lg divide-y">
                  {toolCategories.map((cat) => (
                    <ToolCategory
                      key={cat.title}
                      title={cat.title}
                      icon={<Wrench className="w-4 h-4 text-gray-400" />}
                      tools={cat.tools}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No tools loaded. Server may be unreachable.</p>
              )}
            </div>

            {/* Resources */}
            {resources.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 font-semibold text-lg mb-3">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Resources
                </h3>
                <div className="space-y-2">
                  {resources.map((r) => (
                    <div key={r.uri} className="bg-gray-50 rounded-lg p-3">
                      <code className="text-xs font-mono text-indigo-600">{r.uri}</code>
                      {r.name && <p className="text-sm font-medium mt-1">{r.name}</p>}
                      {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prompts */}
            {prompts.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 font-semibold text-lg mb-3">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                  Prompt Templates
                </h3>
                <div className="space-y-2">
                  {prompts.map((p) => (
                    <div key={p.name} className="bg-gray-50 rounded-lg p-3">
                      <code className="text-xs font-mono text-indigo-600">{p.name}</code>
                      {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// --- API Keys Section ---

function ApiKeysSection({ keys, loading, onCreateKey, onRevokeKey }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              API Keys
            </CardTitle>
            <CardDescription>Create and manage API keys for MCP server access</CardDescription>
          </div>
          <Button onClick={onCreateKey} size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-1">
            <Plus className="w-4 h-4" />
            Create Key
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading keys...
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <KeyRound className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No API keys yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-gray-500">Name</th>
                  <th className="pb-2 font-medium text-gray-500">Key Prefix</th>
                  <th className="pb-2 font-medium text-gray-500">Created</th>
                  <th className="pb-2 font-medium text-gray-500">Last Used</th>
                  <th className="pb-2 font-medium text-gray-500">Status</th>
                  <th className="pb-2 font-medium text-gray-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {keys.map((key) => (
                  <tr key={key.id} className="group">
                    <td className="py-3 font-medium">{key.name}</td>
                    <td className="py-3">
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{key.key_prefix}...</code>
                    </td>
                    <td className="py-3 text-gray-500">
                      {new Date(key.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-gray-500">
                      {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "Never"}
                    </td>
                    <td className="py-3">
                      {key.revoked ? (
                        <Badge variant="destructive" className="text-xs">Revoked</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Active</Badge>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {!key.revoked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRevokeKey(key)}
                          className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Main Page ---

export default function McpApiKeys() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userProfile?.role === "admin";

  const [keys, setKeys] = useState([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [serverInfo, setServerInfo] = useState(null);
  const [serverLoading, setServerLoading] = useState(true);
  const [tools, setTools] = useState([]);
  const [resources, setResources] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [toolsLoading, setToolsLoading] = useState(true);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState(null);
  const [creating, setCreating] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState(null);
  const [revoking, setRevoking] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (userProfile && !isAdmin) {
      navigate("/Dashboard");
    }
  }, [userProfile, isAdmin, navigate]);

  // Load API keys
  const loadKeys = useCallback(async () => {
    setKeysLoading(true);
    const { data, error } = await supabase
      .from("mcp_api_keys")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setKeys(data);
    }
    setKeysLoading(false);
  }, []);

  // Load server info
  const loadServerInfo = useCallback(async () => {
    setServerLoading(true);
    try {
      const res = await fetch(MCP_BASE_URL);
      if (res.ok) {
        const data = await res.json();
        setServerInfo(data);
      }
    } catch {
      setServerInfo(null);
    }
    setServerLoading(false);
  }, []);

  // Load tools from MCP
  const loadTools = useCallback(async () => {
    setToolsLoading(true);
    try {
      // Use the health endpoint info — the tools/list requires auth
      // Instead, fetch tools/list with the user's JWT
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(MCP_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.result?.tools) {
          setTools(data.result.tools);
        }
      }

      // Load resources
      const resResources = await fetch(MCP_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "resources/list",
        }),
      });

      if (resResources.ok) {
        const data = await resResources.json();
        if (data.result?.resources) {
          setResources(data.result.resources);
        }
      }

      // Load prompts
      const resPrompts = await fetch(MCP_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "prompts/list",
        }),
      });

      if (resPrompts.ok) {
        const data = await resPrompts.json();
        if (data.result?.prompts) {
          setPrompts(data.result.prompts);
        }
      }
    } catch {
      // Server unreachable
    }
    setToolsLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadKeys();
      loadServerInfo();
      loadTools();
    }
  }, [isAdmin, loadKeys, loadServerInfo, loadTools]);

  // Create key
  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    setCreating(true);
    try {
      const plainKey = generateApiKey();
      const keyHash = await hashApiKey(plainKey);
      const keyPrefix = plainKey.slice(0, 12);

      const { error } = await supabase.from("mcp_api_keys").insert({
        name: newKeyName.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        created_by: user.id,
      });

      if (error) throw error;

      setCreatedKey(plainKey);
      await loadKeys();
    } catch (err) {
      console.error("Error creating key:", err);
    }
    setCreating(false);
  };

  // Revoke key
  const handleRevokeKey = async () => {
    if (!keyToRevoke) return;

    setRevoking(true);
    try {
      const { error } = await supabase
        .from("mcp_api_keys")
        .update({ revoked: true })
        .eq("id", keyToRevoke.id);

      if (error) throw error;

      await loadKeys();
      setRevokeDialogOpen(false);
      setKeyToRevoke(null);
    } catch (err) {
      console.error("Error revoking key:", err);
    }
    setRevoking(false);
  };

  if (!isAdmin) return null;

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">MCP API Keys</h1>
        <p className="text-gray-500 mt-1">Manage your MCP server connection and API keys</p>
      </div>

      <div className="space-y-6">
        <ServerStatusCard
          serverInfo={serverInfo}
          loading={serverLoading}
          onRefresh={loadServerInfo}
        />

        <DocumentationSection
          tools={tools}
          resources={resources}
          prompts={prompts}
          loadingTools={toolsLoading}
        />

        <ApiKeysSection
          keys={keys}
          loading={keysLoading}
          onCreateKey={() => {
            setNewKeyName("");
            setCreatedKey(null);
            setCreateDialogOpen(true);
          }}
          onRevokeKey={(key) => {
            setKeyToRevoke(key);
            setRevokeDialogOpen(true);
          }}
        />
      </div>

      {/* Create Key Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              {createdKey
                ? "Your API key has been created. Copy it now — it won't be shown again."
                : "Give your key a descriptive name to identify its purpose."}
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 font-medium">
                  Save this key now. You won't be able to see it again.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={createdKey}
                  className="font-mono text-sm"
                />
                <CopyButton text={createdKey} label="Copy" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName">Key Name</Label>
                <Input
                  id="keyName"
                  placeholder="e.g., Claude Desktop, CI/CD Pipeline"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateKey()}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {createdKey ? (
              <Button onClick={() => setCreateDialogOpen(false)}>Done</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateKey}
                  disabled={!newKeyName.trim() || creating}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Key"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Key Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke <strong>{keyToRevoke?.name}</strong>? Any clients using this key will
              immediately lose access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevokeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeKey}
              disabled={revoking}
            >
              {revoking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Revoking...
                </>
              ) : (
                "Revoke Key"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
