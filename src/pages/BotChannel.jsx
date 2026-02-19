import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot,
  Building2,
  ChevronLeft,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

// ─── Constants ───────────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const RELAY_URL = `${SUPABASE_URL}/functions/v1/chat-relay`;

const DEFAULT_AGENT = {
  id: "harmon-bot-core",
  name: "Harmon Bot",
  type: "core",
  subtitle: "Operations Manager Agent",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AgentAvatar({ agent, size = "md" }) {
  const sz = size === "sm" ? "w-7 h-7" : size === "lg" ? "w-11 h-11" : "w-9 h-9";
  const icon = size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-5 h-5" : "w-4 h-4";
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
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      )}
      <div className={`flex flex-col gap-0.5 max-w-[78%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
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

function TypingIndicator() {
  return (
    <div className="flex gap-2 items-end">
      <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
        <Bot className="w-3.5 h-3.5 text-white" />
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

// ─── Agent List Panel ────────────────────────────────────────────────────────

function AgentList({ agents, selectedAgentId, onSelect, search, onSearchChange }) {
  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-gray-900">Agent Workspace</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search agents..."
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Agent rows */}
      <div className="flex-1 overflow-y-auto p-2">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold px-2 py-2">Agents</p>
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelect(agent.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left mb-0.5 ${
              selectedAgentId === agent.id
                ? "bg-indigo-50 text-indigo-700"
                : "hover:bg-gray-50 text-gray-700"
            }`}
          >
            <AgentAvatar agent={agent} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{agent.name}</p>
              <p className="text-[11px] text-gray-400 truncate">{agent.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Chat Panel ──────────────────────────────────────────────────────────────

function ChatArea({ agent, messages, loading, waitingForReply, onSend, onBack, showBackButton }) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, waitingForReply]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [agent.id]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    await onSend(text);
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0 bg-white">
        {showBackButton && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors mr-1"
            aria-label="Back to agents"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <AgentAvatar agent={agent} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{agent.name}</p>
          <p className="text-[11px] text-gray-500 truncate">{agent.subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <span className="text-[11px] text-gray-400">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">Loading messages...</p>
          </div>
        ) : messages.length === 0 && !waitingForReply ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Bot className="w-8 h-8 text-indigo-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{agent.name}</p>
              <p className="text-sm text-gray-400 mt-1 max-w-xs">
                {agent.type === "core"
                  ? "Ask me about tasks, projects, clients, or anything about Harmon Digital."
                  : `Ask me anything about the ${agent.name.replace(" Agent", "")} account.`}
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
      <div className="px-4 pb-4 pt-3 border-t border-gray-100 bg-white shrink-0">
        <div className="flex gap-2 items-end bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-100 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.name}...`}
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none max-h-32 overflow-y-auto leading-relaxed"
            style={{ minHeight: "22px" }}
            onInput={(e) => {
              e.target.style.height = "22px";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
            }}
          />
          <button
            onClick={handleSend}
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
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BotChannel() {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [channelId, setChannelId] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(DEFAULT_AGENT.id);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [waitingForReply, setWaitingForReply] = useState(false);
  const [search, setSearch] = useState("");
  // Mobile: show agent list or chat
  const [mobileView, setMobileView] = useState("list"); // "list" | "chat"
  const realtimeRef = useRef(null);

  const agents = useMemo(() => {
    const clientAgents = (accounts || []).map((a) => ({
      id: `client-${a.id}`,
      name: `${a.company_name} Agent`,
      type: "client",
      subtitle: "Client operations agent",
      accountId: a.id,
    }));
    return [DEFAULT_AGENT, ...clientAgents];
  }, [accounts]);

  const filteredAgents = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter((a) =>
      a.name.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)
    );
  }, [agents, search]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) || DEFAULT_AGENT,
    [agents, selectedAgentId]
  );

  // Bootstrap
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const [{ data: channels }, { data: accountData }] = await Promise.all([
        supabase
          .from("bot_channels")
          .select("id,name")
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .limit(1),
        supabase.from("accounts").select("id,company_name").order("company_name", { ascending: true }),
      ]);

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
      setAccounts(accountData || []);
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
      .channel(`bot-page-${channelId}-${selectedAgentId}`)
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
          const msgAgentId = msg.metadata?.agent_id;
          if (msgAgentId === selectedAgentId || !msgAgentId) {
            setMessages((prev) => {
              if (prev.find((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            if (msg.role === "assistant") setWaitingForReply(false);
          }
        }
      )
      .subscribe();

    realtimeRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [channelId, selectedAgentId]);

  const handleSelectAgent = (agentId) => {
    setSelectedAgentId(agentId);
    setMessages([]);
    setWaitingForReply(false);
    if (isMobile) setMobileView("chat");
  };

  const handleSend = async (text) => {
    if (!channelId || !user?.id) return;

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
    }
  };

  // ── Mobile layout: toggle between agent list and chat ──────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-white overflow-hidden">
        {mobileView === "list" ? (
          <AgentList
            agents={filteredAgents}
            selectedAgentId={selectedAgentId}
            onSelect={handleSelectAgent}
            search={search}
            onSearchChange={setSearch}
          />
        ) : (
          <ChatArea
            agent={selectedAgent}
            messages={messages}
            loading={loading}
            waitingForReply={waitingForReply}
            onSend={handleSend}
            onBack={() => setMobileView("list")}
            showBackButton
          />
        )}
      </div>
    );
  }

  // ── Desktop layout: side-by-side ───────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">
      {/* Agent sidebar — resizable-ish via fixed width */}
      <div className="w-72 shrink-0 flex flex-col border-r border-gray-100 bg-white h-full overflow-hidden">
        <AgentList
          agents={filteredAgents}
          selectedAgentId={selectedAgentId}
          onSelect={handleSelectAgent}
          search={search}
          onSearchChange={setSearch}
        />
      </div>

      {/* Chat area */}
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        <ChatArea
          agent={selectedAgent}
          messages={messages}
          loading={loading}
          waitingForReply={waitingForReply}
          onSend={handleSend}
          showBackButton={false}
        />
      </div>
    </div>
  );
}
