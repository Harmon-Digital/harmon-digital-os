import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Bot, Building2, Search, Send, Sparkles, UserCircle2 } from "lucide-react";

const DEFAULT_AGENT = {
  id: "harmon-bot-core",
  name: "Harmon Bot",
  type: "core",
  subtitle: "Operations Manager Agent",
};

export default function BotChannel() {
  const { user } = useAuth();
  const [channelId, setChannelId] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(DEFAULT_AGENT.id);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

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
    return agents.filter((a) => a.name.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q));
  }, [agents, search]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) || DEFAULT_AGENT,
    [agents, selectedAgentId]
  );

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (channelId && selectedAgentId) {
      loadMessages(channelId, selectedAgentId);
    }
  }, [channelId, selectedAgentId]);

  const bootstrap = async () => {
    setLoading(true);
    try {
      const [{ data: channels }, { data: accountData }] = await Promise.all([
        supabase
          .from("bot_channels")
          .select("id,name")
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .limit(1),
        supabase.from("accounts").select("id,company_name").order("company_name", { ascending: true }),
      ]);

      let activeChannelId = channels?.[0]?.id;

      if (!activeChannelId) {
        const { data: inserted } = await supabase
          .from("bot_channels")
          .insert({ name: "harmon-bot", kind: "internal", is_active: true })
          .select("id")
          .single();
        activeChannelId = inserted?.id;
      }

      setChannelId(activeChannelId || "");
      setAccounts(accountData || []);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (activeChannelId, agentId) => {
    const { data } = await supabase
      .from("bot_messages")
      .select("*")
      .eq("channel_id", activeChannelId)
      .eq("metadata->>agent_id", agentId)
      .order("created_at", { ascending: true })
      .limit(250);

    setMessages(data || []);
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !channelId || !user?.id) return;

    await supabase.from("bot_messages").insert({
      channel_id: channelId,
      role: "user",
      user_id: user.id,
      content: messageText.trim(),
      metadata: {
        source: "harmon-digital-os",
        agent_id: selectedAgent.id,
        agent_type: selectedAgent.type,
        account_id: selectedAgent.accountId || null,
      },
    });

    setMessageText("");
    await loadMessages(channelId, selectedAgent.id);
  };

  if (loading) {
    return <div className="p-8 text-gray-500">Loading agent workspace...</div>;
  }

  return (
    <div className="p-6 lg:p-8 h-[calc(100vh-2rem)]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-indigo-600" /> Agent Workspace
        </h1>
        <p className="text-gray-500 mt-1">Chat with Harmon Bot and your client agents from one modern workspace.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 h-[calc(100%-70px)]">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 space-y-4 h-full flex flex-col">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents..."
                className="pl-9"
              />
            </div>

            <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Agents</div>
            <div className="space-y-2 overflow-y-auto pr-1">
              {filteredAgents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedAgentId === agent.id
                      ? "bg-indigo-50 border-indigo-200"
                      : "bg-white hover:bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${agent.type === "core" ? "text-indigo-600" : "text-slate-500"}`}>
                      {agent.type === "core" ? <Bot className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{agent.name}</p>
                      <p className="text-xs text-gray-500 truncate">{agent.subtitle}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white h-full">
          <CardContent className="p-0 h-full flex flex-col">
            <div className="px-5 py-4 border-b bg-gradient-to-r from-white to-indigo-50 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="text-indigo-600">
                  {selectedAgent.type === "core" ? <Bot className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedAgent.name}</h2>
                  <p className="text-xs text-gray-500">{selectedAgent.subtitle}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-gray-500">
                  <div>
                    <UserCircle2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Start the conversation with this agent.</p>
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                        m.role === "user"
                          ? "bg-indigo-600 text-white rounded-br-md"
                          : "bg-white text-gray-800 rounded-bl-md border"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t bg-white rounded-b-xl">
              <div className="flex gap-2">
                <Textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={`Message ${selectedAgent.name}...`}
                  rows={2}
                  className="resize-none"
                />
                <Button onClick={sendMessage} className="bg-indigo-600 hover:bg-indigo-700 self-end">
                  <Send className="w-4 h-4 mr-2" /> Send
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
