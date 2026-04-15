import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { ChatChannel, ChatMessage, TeamMember } from "@/api/entities";
import { useAuth } from "@/contexts/AuthContext";
import { sendNotification } from "@/api/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Hash, Plus, Send, Search, Loader2, Trash2 } from "lucide-react";

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderBody(body, userIdToName) {
  if (!body) return null;
  const parts = [];
  const regex = /@\[([^\]]+)\]\(([0-9a-f-]+)\)/g;
  let lastIndex = 0;
  let m;
  let key = 0;
  while ((m = regex.exec(body)) !== null) {
    if (m.index > lastIndex) parts.push(<span key={key++}>{body.slice(lastIndex, m.index)}</span>);
    const [, name, id] = m;
    const display = userIdToName?.[id] || name;
    parts.push(
      <span
        key={key++}
        className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[13px] font-medium"
      >
        @{display}
      </span>,
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < body.length) parts.push(<span key={key++}>{body.slice(lastIndex)}</span>);
  return parts;
}

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Channels() {
  const { user } = useAuth();
  const [channels, setChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [authorMap, setAuthorMap] = useState({});
  const [teamMembers, setTeamMembers] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const textareaRef = useRef(null);
  const scrollerRef = useRef(null);
  const realtimeRef = useRef(null);

  const userIdToName = useMemo(() => {
    const m = {};
    for (const tm of teamMembers) if (tm.user_id) m[tm.user_id] = tm.full_name;
    for (const [id, name] of Object.entries(authorMap)) if (!m[id]) m[id] = name;
    return m;
  }, [teamMembers, authorMap]);

  const mentionableUsers = useMemo(
    () =>
      teamMembers
        .filter((tm) => tm.status === "active" && tm.user_id)
        .map((tm) => ({ id: tm.user_id, name: tm.full_name })),
    [teamMembers],
  );

  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId),
    [channels, selectedChannelId],
  );

  // Bootstrap: load channels + team members
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [ch, tm] = await Promise.all([
          ChatChannel.filter({ is_archived: false }, "created_at"),
          TeamMember.list(),
        ]);
        setChannels(ch || []);
        setTeamMembers(tm || []);
        if (ch && ch.length > 0) setSelectedChannelId(ch[0].id);
      } catch (err) {
        console.error("Error loading channels:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const loadMessages = useCallback(
    async (channelId) => {
      if (!channelId) return;
      setLoadingMessages(true);
      try {
        const { data } = await supabase
          .from("chat_messages")
          .select("id, channel_id, user_id, body, mentioned_user_ids, edited_at, created_at")
          .eq("channel_id", channelId)
          .order("created_at", { ascending: true })
          .limit(300);
        setMessages(data || []);

        const missing = Array.from(
          new Set((data || []).map((m) => m.user_id).filter((id) => id && !userIdToName[id])),
        );
        if (missing.length > 0) {
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("id, full_name, email")
            .in("id", missing);
          if (profiles) {
            setAuthorMap((prev) => {
              const next = { ...prev };
              for (const p of profiles) next[p.id] = p.full_name || p.email || "User";
              return next;
            });
          }
        }
      } catch (err) {
        console.error("Error loading messages:", err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [userIdToName],
  );

  useEffect(() => {
    if (selectedChannelId) loadMessages(selectedChannelId);
  }, [selectedChannelId, loadMessages]);

  // Realtime subscription scoped to selected channel
  useEffect(() => {
    if (!selectedChannelId) return;
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);

    const ch = supabase
      .channel(`chat-channel-${selectedChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${selectedChannelId}`,
        },
        (payload) => {
          const msg = payload.new;
          setMessages((prev) => (prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${selectedChannelId}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        },
      )
      .subscribe();

    realtimeRef.current = ch;
    return () => supabase.removeChannel(ch);
  }, [selectedChannelId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, selectedChannelId]);

  const filteredChannels = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, search]);

  // --- Mention autocomplete ---
  const handleDraftChange = (e) => {
    const val = e.target.value;
    const caret = e.target.selectionStart ?? val.length;
    setDraft(val);
    const before = val.slice(0, caret);
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1) {
      setMentionQuery(null);
      return;
    }
    const boundary = atIdx === 0 || /\s/.test(val[atIdx - 1]);
    const tail = before.slice(atIdx + 1);
    if (boundary && !/\s/.test(tail) && tail.length <= 30) {
      setMentionQuery({ start: atIdx, query: tail.toLowerCase() });
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const filteredMentions = useMemo(() => {
    if (!mentionQuery) return [];
    const q = mentionQuery.query;
    if (!q) return mentionableUsers.slice(0, 6);
    return mentionableUsers.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 6);
  }, [mentionQuery, mentionableUsers]);

  const insertMention = (u) => {
    if (!mentionQuery) return;
    const { start } = mentionQuery;
    const caret = textareaRef.current?.selectionStart ?? draft.length;
    const before = draft.slice(0, start);
    const after = draft.slice(caret);
    const token = `@[${u.name}](${u.id}) `;
    const next = before + token + after;
    setDraft(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = before.length + token.length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e) => {
    if (mentionQuery && filteredMentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => Math.min(filteredMentions.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredMentions[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }
    // Plain Enter (no shift) = send
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const extractMentions = (body) => {
    const ids = new Set();
    const regex = /@\[[^\]]+\]\(([0-9a-f-]+)\)/g;
    let m;
    while ((m = regex.exec(body)) !== null) ids.add(m[1]);
    return Array.from(ids);
  };

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !selectedChannelId || !user?.id) return;
    setSubmitting(true);
    try {
      const mentioned = extractMentions(body);
      const created = await ChatMessage.create({
        channel_id: selectedChannelId,
        user_id: user.id,
        body,
        mentioned_user_ids: mentioned,
      });
      // Optimistic add (realtime INSERT will dedupe via id)
      setMessages((prev) => (prev.find((m) => m.id === created.id) ? prev : [...prev, created]));
      setDraft("");
      setMentionQuery(null);

      // Notify mentioned users (skip self)
      if (mentioned.length > 0 && selectedChannel) {
        for (const uid of mentioned) {
          if (uid === user.id) continue;
          try {
            await sendNotification({
              userId: uid,
              type: "info",
              category: "chat",
              priority: "high",
              source: "chat.mention",
              title: `Mentioned in #${selectedChannel.name}`,
              message: body.replace(/@\[([^\]]+)\]\([0-9a-f-]+\)/g, "@$1"),
              link: `/Channels`,
            });
          } catch (err) {
            console.error("mention notify failed:", err);
          }
        }
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMessage = async (msg) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await ChatMessage.delete(msg.id);
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    } catch (err) {
      console.error("delete failed:", err);
    }
  };

  // Group consecutive messages by the same author within 5 minutes
  const grouped = useMemo(() => {
    const out = [];
    let group = null;
    for (const m of messages) {
      const t = new Date(m.created_at).getTime();
      if (
        group &&
        group.user_id === m.user_id &&
        t - new Date(group.messages[group.messages.length - 1].created_at).getTime() < 5 * 60 * 1000
      ) {
        group.messages.push(m);
      } else {
        group = { user_id: m.user_id, messages: [m] };
        out.push(group);
      }
    }
    return out;
  }, [messages]);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white">
      {/* Channel list */}
      <aside className="w-64 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900">Channels</h2>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="p-1 rounded hover:bg-gray-200 text-gray-500"
              title="New channel"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search channels"
              className="pl-7 h-8 text-sm bg-white"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          {loading ? (
            <div className="text-xs text-gray-400 px-3 py-2">Loading…</div>
          ) : filteredChannels.length === 0 ? (
            <div className="text-xs text-gray-400 px-3 py-2">No channels</div>
          ) : (
            filteredChannels.map((c) => {
              const active = c.id === selectedChannelId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedChannelId(c.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${
                    active
                      ? "bg-indigo-100 text-indigo-900 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Hash className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{c.name}</span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Conversation */}
      <main className="flex-1 flex flex-col min-w-0">
        {!selectedChannel ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Select a channel to start chatting
          </div>
        ) : (
          <>
            <header className="border-b border-gray-200 px-5 py-3">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-gray-400" />
                <h1 className="font-semibold text-gray-900">{selectedChannel.name}</h1>
              </div>
              {selectedChannel.description && (
                <p className="text-xs text-gray-500 mt-0.5 ml-6">{selectedChannel.description}</p>
              )}
            </header>

            <div ref={scrollerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {loadingMessages ? (
                <div className="text-xs text-gray-400">Loading…</div>
              ) : grouped.length === 0 ? (
                <div className="text-sm text-gray-400 italic">No messages yet. Say hi 👋</div>
              ) : (
                grouped.map((g, gi) => {
                  const author = userIdToName[g.user_id] || "Unknown";
                  const first = g.messages[0];
                  return (
                    <div key={gi} className="flex gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold flex items-center justify-center shrink-0">
                        {initials(author)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-gray-900">{author}</span>
                          <span className="text-xs text-gray-400">{formatTime(first.created_at)}</span>
                        </div>
                        <div className="space-y-0.5">
                          {g.messages.map((m) => {
                            const mine = m.user_id === user?.id;
                            return (
                              <div key={m.id} className="group flex items-start gap-2">
                                <div className="text-sm text-gray-800 whitespace-pre-wrap break-words flex-1">
                                  {renderBody(m.body, userIdToName)}
                                </div>
                                {mine && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMessage(m)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 rounded"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-gray-200 p-3">
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={handleDraftChange}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message #${selectedChannel.name}`}
                  rows={2}
                  className="resize-none pr-12"
                />
                {mentionQuery && filteredMentions.length > 0 && (
                  <div className="absolute z-10 left-0 bottom-full mb-1 w-64 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                    {filteredMentions.map((u, i) => (
                      <button
                        key={u.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertMention(u);
                        }}
                        onMouseEnter={() => setMentionIndex(i)}
                        className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${
                          i === mentionIndex ? "bg-indigo-50 text-indigo-700" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold flex items-center justify-center shrink-0">
                          {initials(u.name)}
                        </div>
                        <span className="truncate">{u.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!draft.trim() || submitting}
                  className="absolute right-2 bottom-2 p-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Send (Enter)"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 ml-1">
                Enter to send · Shift+Enter for new line · @ to mention
              </div>
            </div>
          </>
        )}
      </main>

      <NewChannelDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={(channel) => {
          setChannels((prev) => [...prev, channel]);
          setSelectedChannelId(channel.id);
          setShowCreate(false);
        }}
      />
    </div>
  );
}

function NewChannelDialog({ open, onOpenChange, onCreated }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  const handleCreate = async () => {
    setError("");
    const cleanedName = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    if (!cleanedName) {
      setError("Please enter a channel name");
      return;
    }
    setSubmitting(true);
    try {
      const created = await ChatChannel.create({
        name: cleanedName,
        description: description.trim() || null,
        created_by: user?.id || null,
      });
      onCreated(created);
    } catch (err) {
      console.error("Create channel failed:", err);
      setError(err.message || "Failed to create channel");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New channel</DialogTitle>
          <DialogDescription>
            Channels are where your team talks about specific topics. Everyone can see and post in a channel.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="channel-name">Name</Label>
            <div className="relative">
              <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="channel-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. announcements"
                className="pl-8"
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-400">Lowercase letters, numbers, and dashes.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="channel-description">Description (optional)</Label>
            <Input
              id="channel-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
            />
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || submitting}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Create channel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
