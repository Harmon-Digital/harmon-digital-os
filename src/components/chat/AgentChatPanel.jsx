import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bot,
  Building2,
  ChevronDown,
  Send,
  Sparkles,
  X,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const PANEL_WIDTH = 380;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const RELAY_URL = `${SUPABASE_URL}/functions/v1/chat-relay`;

const DEFAULT_AGENT = {
  id: "harmon-bot-core",
  name: "Harmon Bot",
  subtitle: "Operations Manager",
  type: "core",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AgentAvatar({ agent, size = "md" }) {
  const sz = size === "sm" ? "w-7 h-7" : "w-9 h-9";
  const icon = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const bg = agent.type === "core" ? "bg-indigo-600" : "bg-slate-500";
  return (
    <div className={`${sz} ${bg} rounded-full flex items-center justify-center shrink-0`}>
      {agent.type === "core"
        ? <Bot className={`${icon} text-white`} />
        : <Building2 className={`${icon} text-white`} />
      }
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[11px] text-gray-400 bg-gray-100 rounded-full px-3 py-0.5">
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
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
            isUser
              ? "bg-indigo-600 text-white rounded-br-sm"
              : "bg-white text-gray-800 rounded-bl-sm border border-gray-100"
          }`}
        >
          {message.content}
        </div>
        <span className="text-[10px] text-gray-400 px-1">
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
        className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left w-full"
      >
        <AgentAvatar agent={selected} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{selected.name}</p>
          <p className="text-[11px] text-gray-500 truncate leading-tight">{selected.subtitle}</p>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => { onSelect(agent.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                agent.id === selectedId ? "bg-indigo-50" : ""
              }`}
            >
              <AgentAvatar agent={agent} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{agent.name}</p>
                <p className="text-[11px] text-gray-500 truncate">{agent.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Typing Indicator ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-2 items-end">
      <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
        <Bot className="w-3 h-3 text-white" />
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function AgentChatPanel({ isOpen, onClose, accounts = [], fullWidth = false }) {
  const { user } = useAuth();
  const [channelId, setChannelId] = useState(null);
  const [selectedAgentId, setSelectedAgentId] = useState(DEFAULT_AGENT.id);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [waitingForReply, setWaitingForReply] = useState(false);
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
  const loadMessages = useCallback(async (cid, agentId) => {
    if (!cid) return;
    const { data } = await supabase
      .from("bot_messages")
      .select("id, role, content, created_at, metadata")
      .eq("channel_id", cid)
      .eq("metadata->>agent_id", agentId)
      .order("created_at", { ascending: true })
      .limit(200);
    setMessages(data || []);
  }, []);

  useEffect(() => {
    if (channelId && selectedAgentId) {
      loadMessages(channelId, selectedAgentId);
    }
  }, [channelId, selectedAgentId, loadMessages]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!channelId) return;
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);

    const channel = supabase
      .channel(`bot-msgs-${channelId}-${selectedAgentId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bot_messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const msg = payload.new;
          const msgAgentId = msg.metadata?.agent_id;
          if (msgAgentId === selectedAgentId || !msgAgentId) {
            setMessages((prev) => {
              if (prev.find((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            // Stop typing indicator when assistant replies
            if (msg.role === "assistant") setWaitingForReply(false);
          }
        }
      )
      .subscribe();

    realtimeRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [channelId, selectedAgentId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, waitingForReply]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !channelId || !user?.id || sending) return;

    setSending(true);
    setInput("");
    setWaitingForReply(true);

    try {
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
        setWaitingForReply(false);
      }
    } catch (err) {
      console.error("sendMessage error", err);
      setWaitingForReply(false);
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

  return (
    <div
      className={`flex flex-col bg-white border-l border-gray-200 shrink-0 overflow-hidden ${fullWidth ? "h-full" : "h-screen"}`}
      style={{
        width: fullWidth ? "100%" : (isOpen ? `${PANEL_WIDTH}px` : "0px"),
        transition: fullWidth ? "none" : "width 300ms cubic-bezier(0.25, 1.1, 0.4, 1)",
      }}
    >
      {isOpen && (
        <>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-gray-100 shrink-0 bg-white">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-900">Agent Chat</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Agent Selector */}
          <div className="px-3 pt-2 pb-2 border-b border-gray-100 shrink-0 bg-white">
            <AgentSelector
              agents={agents}
              selectedId={selectedAgentId}
              onSelect={(id) => {
                setSelectedAgentId(id);
                setMessages([]);
                setWaitingForReply(false);
              }}
            />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-400">Loading...</p>
              </div>
            ) : messages.length === 0 && !waitingForReply ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-6">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <Bot className="w-7 h-7 text-indigo-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">{selectedAgent.name}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Ask me anything about operations, tasks, clients, or projects.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
                {waitingForReply && <TypingIndicator />}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div className="px-3 pb-4 pt-3 border-t border-gray-100 bg-white shrink-0">
            <div className="flex gap-2 items-end bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-100 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${selectedAgent.name}...`}
                rows={1}
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none max-h-32 overflow-y-auto leading-relaxed"
                style={{ minHeight: "22px" }}
                onInput={(e) => {
                  e.target.style.height = "22px";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 self-end"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default AgentChatPanel;
