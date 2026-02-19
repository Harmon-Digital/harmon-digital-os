import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bot,
  Building2,
  ChevronRight,
  Send,
  Sparkles,
  X,
} from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────────

const PANEL_WIDTH = 380;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const RELAY_URL = `${SUPABASE_URL}/functions/v1/chat-relay`;

const DEFAULT_AGENT = {
  id: "harmon-bot-core",
  name: "Harmon Bot",
  subtitle: "Operations Manager",
  type: "core",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AgentAvatar({ agent, size = "md" }) {
  const sz = size === "sm" ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm";
  return agent.type === "core" ? (
    <div className={`${sz} rounded-full bg-indigo-600 flex items-center justify-center shrink-0`}>
      <Bot className={size === "sm" ? "w-3 h-3 text-white" : "w-4 h-4 text-white"} />
    </div>
  ) : (
    <div className={`${sz} rounded-full bg-slate-600 flex items-center justify-center shrink-0`}>
      <Building2 className={size === "sm" ? "w-3 h-3 text-white" : "w-4 h-4 text-white"} />
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-1">
        <span className="text-[11px] text-neutral-500 bg-neutral-800/50 rounded-full px-3 py-0.5">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"} items-end`}>
      {!isUser && (
        <div className="shrink-0 mb-1">
          <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
            <Bot className="w-3 h-3 text-white" />
          </div>
        </div>
      )}
      <div className={`flex flex-col gap-0.5 max-w-[82%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? "bg-indigo-600 text-white rounded-br-sm"
              : "bg-neutral-800 text-neutral-100 rounded-bl-sm"
          }`}
        >
          {message.content}
        </div>
        <span className="text-[10px] text-neutral-500 px-1">
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  );
}

function AgentSelector({ agents, selectedId, onSelect }) {
  const [open, setOpen] = useState(false);
  const selected = agents.find((a) => a.id === selectedId) || DEFAULT_AGENT;
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-neutral-800 transition-colors text-left w-full"
      >
        <AgentAvatar agent={selected} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-100 truncate leading-tight">{selected.name}</p>
          <p className="text-[11px] text-neutral-400 truncate leading-tight">{selected.subtitle}</p>
        </div>
        <ChevronRight
          className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-800 border border-neutral-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => { onSelect(agent.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-neutral-700 transition-colors ${
                agent.id === selectedId ? "bg-neutral-700" : ""
              }`}
            >
              <AgentAvatar agent={agent} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-100 truncate">{agent.name}</p>
                <p className="text-[11px] text-neutral-400 truncate">{agent.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function AgentChatPanel({ isOpen, onClose, accounts = [] }) {
  const { user } = useAuth();
  const [channelId, setChannelId] = useState(null);
  const [selectedAgentId, setSelectedAgentId] = useState(DEFAULT_AGENT.id);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const realtimeRef = useRef(null);

  const agents = useMemo(() => {
    const clientAgents = (accounts || []).map((a) => ({
      id: `client-${a.id}`,
      name: `${a.company_name} Agent`,
      subtitle: "Client agent",
      type: "client",
      accountId: a.id,
    }));
    return [DEFAULT_AGENT, ...clientAgents];
  }, [accounts]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) || DEFAULT_AGENT,
    [agents, selectedAgentId]
  );

  // Bootstrap channel
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data: channels } = await supabase
        .from("bot_channels")
        .select("id")
        .eq("is_active", true)
        .limit(1);

      let cid = channels?.[0]?.id;
      if (!cid) {
        const { data: inserted } = await supabase
          .from("bot_channels")
          .insert({ name: "harmon-bot", kind: "internal", is_active: true })
          .select("id")
          .single();
        cid = inserted?.id;
      }
      setChannelId(cid || null);
      setLoading(false);
    };
    init();
  }, []);

  // Load messages when channel or agent changes
  const loadMessages = useCallback(
    async (cid, agentId) => {
      if (!cid) return;
      const { data } = await supabase
        .from("bot_messages")
        .select("id, role, content, created_at, metadata")
        .eq("channel_id", cid)
        .eq("metadata->>agent_id", agentId)
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages(data || []);
    },
    []
  );

  useEffect(() => {
    if (channelId && selectedAgentId) {
      loadMessages(channelId, selectedAgentId);
    }
  }, [channelId, selectedAgentId, loadMessages]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!channelId) return;

    // Cleanup old subscription
    if (realtimeRef.current) {
      supabase.removeChannel(realtimeRef.current);
    }

    const channel = supabase
      .channel(`bot-messages-${channelId}-${selectedAgentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bot_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const msg = payload.new;
          // Only add if it belongs to the current agent thread
          if (msg.metadata?.agent_id === selectedAgentId || !msg.metadata?.agent_id) {
            setMessages((prev) => {
              if (prev.find((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        }
      )
      .subscribe();

    realtimeRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, selectedAgentId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !channelId || !user?.id || sending) return;

    setSending(true);
    setInput("");

    try {
      // Optimistically add user message
      const optimisticMsg = {
        id: `opt-${Date.now()}`,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
        metadata: { agent_id: selectedAgentId },
      };
      setMessages((prev) => [...prev, optimisticMsg]);

      // Get anon key for edge function call
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const res = await fetch(RELAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          message: text,
          agent_id: selectedAgentId,
          channel_id: channelId,
          user_id: user.id,
          agent_type: selectedAgent.type,
          account_id: selectedAgent.accountId || null,
        }),
      });

      if (!res.ok) {
        console.error("chat-relay error", await res.text());
      }
    } catch (err) {
      console.error("sendMessage error", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={`flex flex-col h-screen bg-neutral-900 border-l border-neutral-800 transition-all duration-300 ease-in-out overflow-hidden shrink-0`}
      style={{ width: isOpen ? `${PANEL_WIDTH}px` : "0px", opacity: isOpen ? 1 : 0 }}
    >
      {isOpen && (
        <>
          {/* Header */}
          <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-neutral-800 shrink-0">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Agent Chat
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Agent Selector */}
          <div className="px-2 pt-2 pb-1 border-b border-neutral-800 shrink-0">
            <AgentSelector
              agents={agents}
              selectedId={selectedAgentId}
              onSelect={(id) => {
                setSelectedAgentId(id);
                setMessages([]);
              }}
            />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-neutral-500 text-sm">Loading...</div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-300">
                    {selectedAgent.name}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Start a conversation
                  </p>
                </div>
              </div>
            ) : (
              messages.map((m) => <MessageBubble key={m.id} message={m} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div className="px-3 pb-3 pt-2 border-t border-neutral-800 shrink-0">
            <div className="flex gap-2 items-end bg-neutral-800 rounded-xl px-3 py-2 border border-neutral-700 focus-within:border-indigo-500 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${selectedAgent.name}...`}
                rows={1}
                className="flex-1 bg-transparent text-sm text-neutral-100 placeholder-neutral-500 resize-none outline-none max-h-32 overflow-y-auto leading-relaxed"
                style={{ minHeight: "22px" }}
                onInput={(e) => {
                  e.target.style.height = "22px";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 self-end mb-0.5"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <p className="text-[10px] text-neutral-600 mt-1.5 text-center">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default AgentChatPanel;
