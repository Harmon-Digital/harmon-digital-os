import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <button onClick={handleCopy} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CopyButtonWithLabel({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-[13px] gap-1">
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function CodeBlock({ children, copyText }) {
  return (
    <div className="relative group">
      <pre className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 p-3 rounded-md overflow-x-auto text-[12px] font-mono leading-relaxed">
        <code>{children}</code>
      </pre>
      {copyText && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButtonWithLabel text={copyText} />
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

function ServerStatusSection({ serverInfo, loading, onRefresh }) {
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
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-2">
          <Server className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          <span className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">MCP Server</span>
        </div>
        <button onClick={onRefresh} disabled={loading} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !serverInfo ? (
        <div className="flex items-center gap-2 text-gray-500 text-[13px] px-2 py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading server info...
        </div>
      ) : serverInfo ? (
        <div className="space-y-4">
          {/* Inline metric strip */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-2">
            <span className="text-[13px] text-gray-600 dark:text-gray-400">Name <span className="text-gray-900 dark:text-gray-100 font-medium">{serverInfo.name}</span></span>
            <span className="text-[13px] text-gray-600 dark:text-gray-400">Version <span className="text-gray-900 dark:text-gray-100 font-medium">{serverInfo.version}</span></span>
            <span className="text-[13px] text-gray-600 dark:text-gray-400">Tools <span className="text-gray-900 dark:text-gray-100 font-medium">{serverInfo.tools}</span></span>
            <span className="text-[13px] text-gray-600 dark:text-gray-400">Resources <span className="text-gray-900 dark:text-gray-100 font-medium">{serverInfo.resources}</span></span>
            <span className="text-[13px] text-gray-600 dark:text-gray-400">Prompts <span className="text-gray-900 dark:text-gray-100 font-medium">{serverInfo.prompts}</span></span>
            <span className="text-[13px] text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
              Status
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              <span className="text-gray-900 dark:text-gray-100 font-medium">Online</span></span>
            </span>
          </div>

          {/* Endpoint field */}
          <div className="space-y-1.5 px-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">MCP Endpoint</div>
            <div className="flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:border-gray-700 transition-colors">
              <input
                value={MCP_ENDPOINT}
                readOnly
                className="flex-1 bg-transparent text-[13px] font-mono text-gray-900 dark:text-gray-100 py-1.5 outline-none"
              />
              <CopyButton text={MCP_ENDPOINT} />
            </div>
          </div>

          {/* Claude Desktop Config */}
          <div className="space-y-1.5 px-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Claude Desktop Config</div>
            <CodeBlock copyText={claudeConfig}>{claudeConfig}</CodeBlock>
          </div>
        </div>
      ) : (
        <div className="text-red-600 text-[13px] px-2">Failed to load server info. The server may be down.</div>
      )}
    </div>
  );
}

// --- Documentation Section ---

function ToolCategory({ title, icon, tools }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors text-left">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{title}</span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">{tools.length}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 border-l border-gray-100 dark:border-gray-800 pl-4 pb-2 space-y-1">
          {tools.map((tool) => (
            <div key={tool.name} className="py-1">
              <code className="text-[12px] font-mono text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-1.5 py-0.5 rounded">{tool.name}</code>
              {tool.description && (
                <p className="text-[12px] text-gray-500 mt-0.5">{tool.description}</p>
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
      let category = "Other";
      const name = tool.name;

      if (name.startsWith("list_") || name.startsWith("get_") || name.startsWith("create_") || name.startsWith("update_") || name.startsWith("delete_") || name.startsWith("search_")) {
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

    const crudCategories = {};
    const specialCategories = {};

    for (const [cat, catTools] of Object.entries(categories)) {
      if (cat.startsWith("CRUD:")) {
        const entity = cat.replace("CRUD: ", "");
        if (!crudCategories[entity]) crudCategories[entity] = [];
        crudCategories[entity].push(...catTools);
      } else {
        specialCategories[cat] = catTools;
      }
    }

    const result = [];

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

    const sortedEntities = Object.keys(entityMap).sort();
    for (const entity of sortedEntities) {
      result.push({
        title: entity.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        tools: entityMap[entity],
      });
    }

    for (const [cat, catTools] of Object.entries(specialCategories)) {
      if (catTools.length > 0 && cat !== "Other") {
        result.push({ title: cat, tools: catTools });
      }
    }

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
    <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
      <Collapsible open={docsOpen} onOpenChange={setDocsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-2 text-left">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            <span className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">Documentation</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform ${docsOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-6 pt-3 px-2">
            {/* Getting Started */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Getting Started</span>
              </div>
              <ol className="space-y-2 text-[13px] text-gray-600 dark:text-gray-400 ml-5">
                <li className="flex gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100 shrink-0">1.</span>
                  <span>Create an API key below using the "Create Key" button.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100 shrink-0">2.</span>
                  <span>
                    Copy the Claude Desktop config JSON from above and replace{" "}
                    <code className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-1 rounded text-[12px] font-mono">YOUR_API_KEY_HERE</code> with your new key.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100 shrink-0">3.</span>
                  <span>
                    Paste the config into your Claude Desktop settings file at{" "}
                    <code className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-1 rounded text-[12px] font-mono">~/Library/Application Support/Claude/claude_desktop_config.json</code>
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100 shrink-0">4.</span>
                  <span>Restart Claude Desktop. You should see the MCP tools available.</span>
                </li>
              </ol>

              <div className="mt-3 space-y-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Test with curl</div>
                <CodeBlock copyText={curlInit}>{curlInit}</CodeBlock>
                <CodeBlock copyText={curlListTools}>{curlListTools}</CodeBlock>
                <CodeBlock copyText={curlCallTool}>{curlCallTool}</CodeBlock>
              </div>
            </div>

            {/* Authentication */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Authentication</span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3 px-2 py-2.5 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex-1">
                    <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">API Key Mode</span>
                    <p className="text-[12px] text-gray-500 mt-0.5">
                      Pass <code className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-1 rounded text-[12px] font-mono">X-API-Key: your_key</code> header.
                      Uses the service role — full access, bypasses RLS. Best for Claude Desktop and automation.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-2 py-2.5 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex-1">
                    <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">JWT Mode</span>
                    <p className="text-[12px] text-gray-500 mt-0.5">
                      Pass <code className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-1 rounded text-[12px] font-mono">Authorization: Bearer jwt_token</code> header.
                      User-scoped with RLS. Best for per-user access from the frontend.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Available Tools */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Available Tools</span>
                {tools.length > 0 && (
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">{tools.length}</span>
                )}
              </div>
              {loadingTools ? (
                <div className="flex items-center gap-2 text-gray-500 text-[13px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading tools from server...
                </div>
              ) : toolCategories.length > 0 ? (
                <div className="border-t border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                  {toolCategories.map((cat) => (
                    <ToolCategory
                      key={cat.title}
                      title={cat.title}
                      icon={<Wrench className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />}
                      tools={cat.tools}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-gray-500">No tools loaded. Server may be unreachable.</p>
              )}
            </div>

            {/* Resources */}
            {resources.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                  <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Resources</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-800">
                  {resources.map((r) => (
                    <div key={r.uri} className="px-2 py-2 border-b border-gray-100 dark:border-gray-800">
                      <code className="text-[12px] font-mono text-gray-900 dark:text-gray-100">{r.uri}</code>
                      {r.name && <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100 mt-0.5">{r.name}</p>}
                      {r.description && <p className="text-[12px] text-gray-500 mt-0.5">{r.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prompts */}
            {prompts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                  <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Prompt Templates</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-800">
                  {prompts.map((p) => (
                    <div key={p.name} className="px-2 py-2 border-b border-gray-100 dark:border-gray-800">
                      <code className="text-[12px] font-mono text-gray-900 dark:text-gray-100">{p.name}</code>
                      {p.description && <p className="text-[12px] text-gray-500 mt-0.5">{p.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// --- API Keys Section ---

function ApiKeysSection({ keys, loading, onCreateKey, onRevokeKey }) {
  return (
    <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          <span className="h-7 text-[11px] font-medium uppercase tracking-wide text-gray-500 flex items-center">API Keys</span>
        </div>
        <Button onClick={onCreateKey} size="sm" className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px] gap-1">
          <Plus className="w-3.5 h-3.5" />
          Create Key
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-8 justify-center text-[13px]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading keys...
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-8">
          <KeyRound className="w-6 h-6 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
          <p className="text-[13px] text-gray-500">No API keys yet. Create one to get started.</p>
        </div>
      ) : (
        <div>
          {keys.map((key) => (
            <div key={key.id} className="group flex items-center gap-3 px-2 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60">
              {/* Name */}
              <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100 min-w-[120px]">{key.name}</span>

              {/* Key prefix - masked */}
              <code className="text-[12px] font-mono text-gray-500 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-1.5 py-0.5 rounded">{key.key_prefix}...</code>

              {/* Created */}
              <span className="text-[13px] text-gray-500 hidden sm:inline">
                {new Date(key.created_at).toLocaleDateString()}
              </span>

              {/* Last used */}
              <span className="text-[13px] text-gray-400 dark:text-gray-500 hidden md:inline">
                {key.last_used_at ? `Used ${new Date(key.last_used_at).toLocaleDateString()}` : "Never used"}
              </span>

              {/* Status dot */}
              <span className="flex items-center gap-1.5 ml-auto">
                {key.revoked ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                    <span className="text-[12px] text-gray-500">Revoked</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                    <span className="text-[12px] text-gray-500">Active</span>
                  </>
                )}
              </span>

              {/* Hover-revealed revoke */}
              {!key.revoked && (
                <button
                  onClick={() => onRevokeKey(key)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
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
    <div className="p-4 lg:p-6 max-w-5xl">
      {/* 48px toolbar header */}
      <div className="flex items-center h-12 border-b border-gray-200 dark:border-gray-800 mb-4">
        <h1 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">MCP API Keys</h1>
      </div>

      <div className="space-y-6">
        <ServerStatusSection
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
                ? "Your API key has been created. Copy it now -- it won't be shown again."
                : "Give your key a descriptive name to identify its purpose."}
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <p className="text-[13px] text-amber-800 font-medium">
                  Save this key now. You won't be able to see it again.
                </p>
              </div>
              <div className="flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:border-gray-700 transition-colors">
                <input
                  readOnly
                  value={createdKey}
                  className="flex-1 bg-transparent text-[13px] font-mono text-gray-900 dark:text-gray-100 py-1.5 outline-none"
                />
                <CopyButton text={createdKey} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName" className="text-[13px]">Key Name</Label>
                <Input
                  id="keyName"
                  placeholder="e.g., Claude Desktop, CI/CD Pipeline"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateKey()}
                  className="text-[13px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {createdKey ? (
              <Button onClick={() => setCreateDialogOpen(false)} className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]">Done</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setCreateDialogOpen(false)} className="h-7 px-2 text-[13px]">
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateKey}
                  disabled={!newKeyName.trim() || creating}
                  className="bg-gray-900 hover:bg-gray-800 text-white h-7 px-2.5 text-[13px]"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
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
            <Button variant="ghost" onClick={() => setRevokeDialogOpen(false)} className="h-7 px-2 text-[13px]">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeKey}
              disabled={revoking}
              className="h-7 px-2.5 text-[13px]"
            >
              {revoking ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
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
