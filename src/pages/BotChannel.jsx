import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send, Slack, Hash } from "lucide-react";

export default function BotChannel() {
  const { user, userProfile } = useAuth();
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState("");
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);

  const [slackChannelId, setSlackChannelId] = useState("");
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [savingSlack, setSavingSlack] = useState(false);

  const isAdmin = userProfile?.role === "admin";

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId),
    [channels, activeChannelId]
  );

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    if (activeChannelId) {
      loadMessages(activeChannelId);
      loadSlackIntegration(activeChannelId);
    }
  }, [activeChannelId]);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("bot_channels")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      setChannels(data || []);
      if (data?.length) setActiveChannelId(data[0].id);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (channelId) => {
    const { data } = await supabase
      .from("bot_messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true })
      .limit(200);

    setMessages(data || []);
  };

  const loadSlackIntegration = async (channelId) => {
    const { data } = await supabase
      .from("bot_channel_integrations")
      .select("*")
      .eq("channel_id", channelId)
      .eq("provider", "slack")
      .maybeSingle();

    const cfg = data?.config || {};
    setSlackChannelId(cfg.channel_id || "");
    setSlackWebhookUrl(cfg.webhook_url || "");
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !activeChannelId || !user?.id) return;

    await supabase.from("bot_messages").insert({
      channel_id: activeChannelId,
      role: "user",
      user_id: user.id,
      content: messageText.trim(),
      metadata: { source: "harmon-digital-os" },
    });

    setMessageText("");
    await loadMessages(activeChannelId);
  };

  const saveSlackConfig = async () => {
    if (!activeChannelId) return;
    setSavingSlack(true);
    try {
      const payload = {
        channel_id: activeChannelId,
        provider: "slack",
        is_enabled: !!slackChannelId,
        config: {
          channel_id: slackChannelId || null,
          webhook_url: slackWebhookUrl || null,
        },
        updated_at: new Date().toISOString(),
      };

      await supabase.from("bot_channel_integrations").upsert(payload, { onConflict: "channel_id,provider" });
    } finally {
      setSavingSlack(false);
    }
  };

  if (loading) {
    return <div className="p-6 lg:p-8 text-gray-500">Loading bot channel...</div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-7 h-7 text-indigo-600" /> Harmon Bot Channel
        </h1>
        <p className="text-gray-500 mt-1">Internal chat channel plus external relay setup (Slack/others).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Channel Conversation</CardTitle>
            <CardDescription>Use this as the in-OS channel for requests and updates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={activeChannelId} onValueChange={setActiveChannelId}>
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channel.name} ({channel.kind})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="border rounded-lg p-3 h-[420px] overflow-y-auto space-y-3 bg-gray-50">
              {messages.length === 0 ? (
                <p className="text-sm text-gray-500">No messages yet.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`p-3 rounded-lg ${m.role === "user" ? "bg-white" : "bg-indigo-50"}`}>
                    <div className="text-xs text-gray-500 mb-1">{m.role}</div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{m.content}</div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Message Harmon Bot..."
                rows={2}
              />
              <Button onClick={sendMessage} className="bg-indigo-600 hover:bg-indigo-700 self-end">
                <Send className="w-4 h-4 mr-2" /> Send
              </Button>
            </div>
            <p className="text-xs text-gray-500">Next step: wire this channel to OpenClaw session bridge for live assistant replies.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Slack className="w-5 h-5" /> Slack Relay</CardTitle>
            <CardDescription>Configure a Slack destination for bot channel mirroring.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Slack Channel ID</label>
              <Input value={slackChannelId} onChange={(e) => setSlackChannelId(e.target.value)} placeholder="C0123456789" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Slack Incoming Webhook (optional)</label>
              <Input value={slackWebhookUrl} onChange={(e) => setSlackWebhookUrl(e.target.value)} placeholder="https://hooks.slack.com/services/..." />
            </div>
            <Button onClick={saveSlackConfig} disabled={!isAdmin || savingSlack} className="w-full">
              <Hash className="w-4 h-4 mr-2" /> {savingSlack ? "Saving..." : "Save Slack Config"}
            </Button>
            {!isAdmin && <p className="text-xs text-gray-500">Admin role required to edit integration settings.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
