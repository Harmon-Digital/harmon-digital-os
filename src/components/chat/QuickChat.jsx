import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/api/supabaseClient";
import { ChatChannel, ChatMessage, TeamMember } from "@/api/entities";
import { useAuth } from "@/contexts/AuthContext";
import UserAvatar from "@/components/ui/UserAvatar";
import { MessageSquare, Hash, Send, ArrowLeft, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function formatShort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function QuickChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("list"); // list | thread
  const [activeChannel, setActiveChannel] = useState(null);
  const [channels, setChannels] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [unread, setUnread] = useState(new Map());
  const scrollerRef = useRef(null);

  // Load channels + members on first open (lazy)
  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [chs, tms] = await Promise.all([
          ChatChannel.filter({ is_archived: false }, "created_at").catch(() => []),
          TeamMember.list().catch(() => []),
        ]);
        if (cancelled) return;
        setChannels(chs || []);
        setTeamMembers(tms || []);
      } catch (err) {
        console.error("QuickChat load failed:", err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, user?.id]);

  // Subscribe to all messages globally so unread updates while popover closed
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel("quickchat-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const msg = payload.new;
          if (!msg || msg.user_id === user.id) return;
          setUnread((prev) => {
            const next = new Map(prev);
            next.set(msg.channel_id, (next.get(msg.channel_id) || 0) + 1);
            return next;
          });
          // If currently viewing this channel, append immediately
          if (activeChannel?.id === msg.channel_id) {
            setMessages((prev) => (prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]));
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, activeChannel?.id]);

  const userIdToName = useMemo(() => {
    const m = {};
    for (const tm of teamMembers) if (tm.user_id) m[tm.user_id] = tm.full_name;
    return m;
  }, [teamMembers]);

  const userIdToImage = useMemo(() => {
    const m = {};
    for (const tm of teamMembers) if (tm.user_id) m[tm.user_id] = tm.profile_image_url;
    return m;
  }, [teamMembers]);

  const dmPartnerId = useCallback(
    (channel) => (channel.dm_user_ids || []).find((id) => id !== user?.id),
    [user?.id],
  );

  const displayNameForChannel = useCallback(
    (c) => {
      if (!c.is_dm) return c.name;
      const partnerId = dmPartnerId(c);
      return userIdToName[partnerId] || "Direct message";
    },
    [dmPartnerId, userIdToName],
  );

  // Filter + sort: DMs to me + public channels, by recency-ish (no last_message_at, so use created_at)
  const visibleChannels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return channels
      .filter((c) => {
        if (c.is_dm) {
          if (!user?.id) return false;
          if (!(c.dm_user_ids || []).includes(user.id)) return false;
        }
        if (q) {
          const name = displayNameForChannel(c).toLowerCase();
          return name.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        // Active huddle / unread first, then DMs, then channels
        const ua = unread.get(a.id) || 0;
        const ub = unread.get(b.id) || 0;
        if (ua !== ub) return ub - ua;
        if (a.is_dm !== b.is_dm) return a.is_dm ? -1 : 1;
        return (b.created_at || "").localeCompare(a.created_at || "");
      })
      .slice(0, 12);
  }, [channels, search, user?.id, displayNameForChannel, unread]);

  const openThread = useCallback(
    async (channel) => {
      setActiveChannel(channel);
      setView("thread");
      setUnread((prev) => {
        const next = new Map(prev);
        next.delete(channel.id);
        return next;
      });
      // Load latest 30 messages
      const { data } = await supabase
        .from("chat_messages")
        .select("id, channel_id, user_id, body, created_at")
        .eq("channel_id", channel.id)
        .order("created_at", { ascending: false })
        .limit(30);
      const ordered = (data || []).reverse();
      setMessages(ordered);
      // Scroll to bottom on next paint
      requestAnimationFrame(() => {
        if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
      });
    },
    [],
  );

  // Auto-scroll on new messages while thread is open
  useEffect(() => {
    if (view === "thread" && scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, view]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !activeChannel?.id || !user?.id) return;
    setSending(true);
    try {
      const { data: created, error } = await supabase
        .from("chat_messages")
        .insert({
          channel_id: activeChannel.id,
          user_id: user.id,
          body,
          mentioned_user_ids: [],
        })
        .select()
        .single();
      if (error) throw error;
      setMessages((prev) => (prev.find((m) => m.id === created.id) ? prev : [...prev, created]));
      setDraft("");
    } catch (err) {
      console.error("QuickChat send failed:", err);
    } finally {
      setSending(false);
    }
  };

  const totalUnread = useMemo(
    () => Array.from(unread.values()).reduce((sum, n) => sum + n, 0),
    [unread],
  );

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setView("list"); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Quick chat"
          // Position: above the QuickActions FAB (which is at bottom-6 right-6)
          className="fixed bottom-20 right-6 z-50 w-11 h-11 rounded-full bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 shadow-md ring-1 ring-black/10 dark:ring-white/10 flex items-center justify-center transition-all"
          title="Quick chat"
        >
          <MessageSquare className="w-4 h-4" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold ring-2 ring-white dark:ring-gray-950">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={8}
        className="w-[380px] p-0 overflow-hidden"
      >
        {view === "list" ? (
          <>
            <div className="flex items-center gap-2 px-3 h-10 border-b border-gray-200 dark:border-gray-800">
              <span className="text-[12px] font-medium uppercase tracking-wide text-gray-500">Chat</span>
              <button
                type="button"
                onClick={() => { setOpen(false); navigate("/Channels"); }}
                className="ml-auto text-[11px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Open full chat →
              </button>
            </div>
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search channels & DMs"
                  className="pl-7 h-7 text-[13px] border-gray-200 dark:border-gray-800"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {visibleChannels.length === 0 ? (
                <div className="py-10 text-center text-[13px] text-gray-400 dark:text-gray-500">
                  No conversations
                </div>
              ) : (
                visibleChannels.map((c) => {
                  const count = unread.get(c.id) || 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => openThread(c)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800"
                    >
                      {c.is_dm ? (
                        <UserAvatar
                          name={displayNameForChannel(c)}
                          imageUrl={userIdToImage[dmPartnerId(c)]}
                          size="sm"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                          <Hash className="w-3.5 h-3.5 text-gray-500" />
                        </div>
                      )}
                      <span className="flex-1 truncate text-[13px] text-gray-900 dark:text-gray-100">
                        {displayNameForChannel(c)}
                      </span>
                      {count > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold">
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 px-2 h-10 border-b border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setView("list")}
                className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              {activeChannel?.is_dm ? (
                <UserAvatar
                  name={displayNameForChannel(activeChannel)}
                  imageUrl={userIdToImage[dmPartnerId(activeChannel)]}
                  size="xs"
                />
              ) : (
                <Hash className="w-3.5 h-3.5 text-gray-500" />
              )}
              <span className="flex-1 truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">
                {displayNameForChannel(activeChannel)}
              </span>
              <button
                type="button"
                onClick={() => { setOpen(false); navigate(`/Channels?channelId=${activeChannel.id}`); }}
                className="text-[11px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Open
              </button>
            </div>

            <div ref={scrollerRef} className="h-[300px] overflow-y-auto px-3 py-2 space-y-2 bg-gray-50/30 dark:bg-gray-900/30">
              {messages.length === 0 ? (
                <div className="py-10 text-center text-[12px] text-gray-400 dark:text-gray-500">
                  No messages yet. Say hi 👋
                </div>
              ) : (
                messages.map((m) => {
                  const mine = m.user_id === user?.id;
                  return (
                    <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                      <UserAvatar
                        name={userIdToName[m.user_id] || "User"}
                        imageUrl={userIdToImage[m.user_id]}
                        size="xs"
                      />
                      <div className={`flex-1 min-w-0 ${mine ? "text-right" : ""}`}>
                        <div className={`inline-block max-w-[85%] rounded-md px-2 py-1.5 text-[12px] ${
                          mine
                            ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                            : "bg-white border border-gray-200 dark:bg-gray-950 dark:border-gray-800 text-gray-900 dark:text-gray-100"
                        }`}>
                          <span className="whitespace-pre-wrap break-words">
                            {(m.body || "").replace(/@\[([^\]]+)\]\([0-9a-f-]+\)/g, "@$1")}
                          </span>
                        </div>
                        <div className={`text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 ${mine ? "" : "ml-1"}`}>
                          {!mine && (userIdToName[m.user_id] || "User")}
                          {!mine && " · "}
                          {formatShort(m.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 p-2">
              <div className="relative">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Message ${displayNameForChannel(activeChannel)}…`}
                  rows={2}
                  className="resize-none pr-9 text-[12px] border-gray-200 dark:border-gray-800"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  className="absolute right-1.5 bottom-1.5 p-1.5 rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-90 disabled:opacity-40"
                  title="Send (Enter)"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
