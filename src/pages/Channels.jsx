import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { ChatChannel, ChatMessage, ChatMessageReaction, TeamMember } from "@/api/entities";
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
import UserAvatar from "@/components/ui/UserAvatar";
import {
  Hash,
  Plus,
  Send,
  Search,
  Loader2,
  Trash2,
  MessageCircle,
  Smile,
  Pencil,
  Pin,
  X,
  Check,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Download,
} from "lucide-react";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

function isImageType(t) {
  return t && t.startsWith("image/");
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const QUICK_REACTIONS = ["👍", "❤️", "🎉", "😂", "🚀", "👀", "✅", "🔥"];

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
  const [pendingFiles, setPendingFiles] = useState([]); // [{ file, previewUrl }]
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [attachments, setAttachments] = useState(new Map()); // messageId -> [attachment]
  const fileInputRef = useRef(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [authorMap, setAuthorMap] = useState({});
  const [avatarMap, setAvatarMap] = useState({}); // user_id -> image url
  const [teamMembers, setTeamMembers] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [reactions, setReactions] = useState(new Map()); // message_id -> [{id, user_id, emoji}]
  const [reactionPickerFor, setReactionPickerFor] = useState(null); // message_id
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [showPinned, setShowPinned] = useState(false);

  const textareaRef = useRef(null);
  const scrollerRef = useRef(null);
  const realtimeRef = useRef(null);
  const selectedChannelIdRef = useRef(null);

  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  const [reads, setReads] = useState(() => new Map()); // channel_id -> last_read_at ISO
  const [unread, setUnread] = useState(() => new Map()); // channel_id -> count

  useEffect(() => {
    selectedChannelIdRef.current = selectedChannelId;
  }, [selectedChannelId]);

  const userIdToName = useMemo(() => {
    const m = {};
    for (const tm of teamMembers) if (tm.user_id) m[tm.user_id] = tm.full_name;
    for (const [id, name] of Object.entries(authorMap)) if (!m[id]) m[id] = name;
    return m;
  }, [teamMembers, authorMap]);

  const userIdToImage = useMemo(() => {
    const m = {};
    for (const tm of teamMembers) {
      if (tm.user_id && tm.profile_image_url) m[tm.user_id] = tm.profile_image_url;
    }
    for (const [id, url] of Object.entries(avatarMap)) {
      if (!m[id] && url) m[id] = url;
    }
    return m;
  }, [teamMembers, avatarMap]);

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

  // For a DM, return the other participant's user_id (or null).
  const dmPartnerId = (channel) => {
    if (!channel?.is_dm || !user?.id) return null;
    return (channel.dm_user_ids || []).find((id) => id !== user.id) || null;
  };

  const displayNameForChannel = (c) => {
    if (!c) return "";
    if (c.is_dm) {
      const other = dmPartnerId(c);
      return userIdToName[other] || "Direct message";
    }
    return c.name;
  };

  const publicChannels = useMemo(
    () => channels.filter((c) => !c.is_dm),
    [channels],
  );
  const dmChannels = useMemo(
    () =>
      channels
        .filter((c) => c.is_dm && user?.id && (c.dm_user_ids || []).includes(user.id))
        .sort((a, b) => {
          const an = displayNameForChannel(a).toLowerCase();
          const bn = displayNameForChannel(b).toLowerCase();
          return an.localeCompare(bn);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channels, user?.id, userIdToName],
  );

  // Bootstrap: load channels + team members + reads + initial unread counts
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [ch, tm, readsResp] = await Promise.all([
          ChatChannel.filter({ is_archived: false }, "created_at"),
          TeamMember.list(),
          user?.id
            ? supabase
                .from("chat_channel_reads")
                .select("channel_id, last_read_at")
                .eq("user_id", user.id)
            : Promise.resolve({ data: [] }),
        ]);
        setChannels(ch || []);
        setTeamMembers(tm || []);

        const readsMap = new Map();
        for (const r of readsResp?.data || []) readsMap.set(r.channel_id, r.last_read_at);
        setReads(readsMap);

        // Initial unread counts per channel (fires per-channel COUNT in parallel)
        if (user?.id && (ch || []).length > 0) {
          const entries = await Promise.all(
            ch.map(async (c) => {
              const since = readsMap.get(c.id) || "1970-01-01T00:00:00Z";
              const { count } = await supabase
                .from("chat_messages")
                .select("id", { count: "exact", head: true })
                .eq("channel_id", c.id)
                .gt("created_at", since)
                .neq("user_id", user.id);
              return [c.id, count || 0];
            }),
          );
          setUnread(new Map(entries));
        }

        if (ch && ch.length > 0) setSelectedChannelId(ch[0].id);
      } catch (err) {
        console.error("Error loading channels:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Mark channel as read (optimistic + upsert)
  const markRead = useCallback(
    async (channelId) => {
      if (!channelId || !user?.id) return;
      const now = new Date().toISOString();
      setReads((prev) => {
        const next = new Map(prev);
        next.set(channelId, now);
        return next;
      });
      setUnread((prev) => {
        if (!prev.has(channelId)) return prev;
        const next = new Map(prev);
        next.set(channelId, 0);
        return next;
      });
      try {
        await supabase
          .from("chat_channel_reads")
          .upsert(
            { user_id: user.id, channel_id: channelId, last_read_at: now },
            { onConflict: "user_id,channel_id" },
          );
      } catch (err) {
        console.error("markRead failed:", err);
      }
    },
    [user?.id],
  );

  // Mark the selected channel as read on select or when it already has messages loaded
  useEffect(() => {
    if (selectedChannelId) markRead(selectedChannelId);
  }, [selectedChannelId, markRead]);

  // Global subscription: bump unread for messages in non-active channels.
  // RLS ensures we only receive messages from channels we can see.
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel("chat-global-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const msg = payload.new;
          if (!msg || msg.user_id === user.id) return;
          if (msg.channel_id === selectedChannelIdRef.current) {
            // Currently viewing -> mark as read
            markRead(msg.channel_id);
            return;
          }
          setUnread((prev) => {
            const next = new Map(prev);
            next.set(msg.channel_id, (next.get(msg.channel_id) || 0) + 1);
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_channels" },
        (payload) => {
          const newCh = payload.new;
          if (!newCh) return;
          setChannels((prev) =>
            prev.find((c) => c.id === newCh.id) ? prev : [...prev, newCh],
          );
        },
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?.id, markRead]);

  // Presence: track who is currently online
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase.channel("chat-presence", {
      config: { presence: { key: user.id } },
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      setOnlineUserIds(new Set(Object.keys(state)));
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ user_id: user.id, online_at: new Date().toISOString() });
      }
    });
    return () => supabase.removeChannel(ch);
  }, [user?.id]);

  const loadMessages = useCallback(
    async (channelId) => {
      if (!channelId) return;
      setLoadingMessages(true);
      try {
        const { data } = await supabase
          .from("chat_messages")
          .select("id, channel_id, user_id, body, mentioned_user_ids, edited_at, is_pinned, pinned_by, pinned_at, created_at")
          .eq("channel_id", channelId)
          .order("created_at", { ascending: true })
          .limit(300);
        setMessages(data || []);

        // Load reactions + attachments for all loaded messages
        const ids = (data || []).map((m) => m.id);
        if (ids.length > 0) {
          const [{ data: rxs }, { data: atts }] = await Promise.all([
            supabase
              .from("chat_message_reactions")
              .select("id, message_id, user_id, emoji")
              .in("message_id", ids),
            supabase
              .from("chat_message_attachments")
              .select("id, message_id, file_name, file_url, file_path, file_type, file_size, uploaded_by, created_at")
              .in("message_id", ids),
          ]);
          const rxMap = new Map();
          for (const r of rxs || []) {
            const arr = rxMap.get(r.message_id) || [];
            arr.push(r);
            rxMap.set(r.message_id, arr);
          }
          setReactions(rxMap);

          const attMap = new Map();
          for (const a of atts || []) {
            const arr = attMap.get(a.message_id) || [];
            arr.push(a);
            attMap.set(a.message_id, arr);
          }
          setAttachments(attMap);
        } else {
          setReactions(new Map());
          setAttachments(new Map());
        }

        const missing = Array.from(
          new Set((data || []).map((m) => m.user_id).filter((id) => id && !userIdToName[id])),
        );
        if (missing.length > 0) {
          const [{ data: profiles }, { data: tms }] = await Promise.all([
            supabase
              .from("user_profiles")
              .select("id, full_name, email")
              .in("id", missing),
            supabase
              .from("team_members")
              .select("user_id, full_name, profile_image_url")
              .in("user_id", missing),
          ]);
          if (profiles) {
            setAuthorMap((prev) => {
              const next = { ...prev };
              for (const p of profiles) next[p.id] = p.full_name || p.email || "User";
              return next;
            });
          }
          if (tms) {
            setAuthorMap((prev) => {
              const next = { ...prev };
              for (const t of tms) if (t.full_name) next[t.user_id] = t.full_name;
              return next;
            });
            setAvatarMap((prev) => {
              const next = { ...prev };
              for (const t of tms) if (t.profile_image_url) next[t.user_id] = t.profile_image_url;
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
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${selectedChannelId}`,
        },
        (payload) => {
          const upd = payload.new;
          setMessages((prev) => prev.map((m) => (m.id === upd.id ? { ...m, ...upd } : m)));
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
          setReactions((prev) => {
            const next = new Map(prev);
            next.delete(payload.old.id);
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_message_reactions" },
        (payload) => {
          const r = payload.new;
          setReactions((prev) => {
            const arr = prev.get(r.message_id) || [];
            if (arr.find((x) => x.id === r.id)) return prev;
            const next = new Map(prev);
            next.set(r.message_id, [...arr, r]);
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_message_reactions" },
        (payload) => {
          const old = payload.old;
          setReactions((prev) => {
            const arr = prev.get(old.message_id);
            if (!arr) return prev;
            const next = new Map(prev);
            next.set(
              old.message_id,
              arr.filter((x) => x.id !== old.id),
            );
            return next;
          });
        },
      )
      .subscribe();

    realtimeRef.current = ch;
    return () => supabase.removeChannel(ch);
  }, [selectedChannelId]);

  // --- Message actions ---
  const toggleReaction = async (messageId, emoji) => {
    if (!user?.id) return;
    const arr = reactions.get(messageId) || [];
    const existing = arr.find((r) => r.user_id === user.id && r.emoji === emoji);
    try {
      if (existing) {
        // Optimistic remove
        setReactions((prev) => {
          const next = new Map(prev);
          next.set(messageId, (next.get(messageId) || []).filter((r) => r.id !== existing.id));
          return next;
        });
        await ChatMessageReaction.delete(existing.id);
      } else {
        const created = await ChatMessageReaction.create({
          message_id: messageId,
          user_id: user.id,
          emoji,
        });
        setReactions((prev) => {
          const next = new Map(prev);
          const cur = next.get(messageId) || [];
          if (!cur.find((r) => r.id === created.id)) next.set(messageId, [...cur, created]);
          return next;
        });
      }
    } catch (err) {
      // Unique constraint or RLS miss — reload
      console.error("toggleReaction failed:", err);
    }
    setReactionPickerFor(null);
  };

  const startEdit = (m) => {
    setEditingMessageId(m.id);
    setEditDraft(m.body);
  };
  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditDraft("");
  };
  const saveEdit = async () => {
    if (!editingMessageId) return;
    const body = editDraft.trim();
    if (!body) return;
    try {
      const updated = await ChatMessage.update(editingMessageId, {
        body,
        edited_at: new Date().toISOString(),
      });
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      cancelEdit();
    } catch (err) {
      console.error("saveEdit failed:", err);
    }
  };

  const togglePin = async (m) => {
    const next = !m.is_pinned;
    try {
      const updated = await ChatMessage.update(m.id, {
        is_pinned: next,
        pinned_by: next ? user?.id || null : null,
        pinned_at: next ? new Date().toISOString() : null,
      });
      setMessages((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
    } catch (err) {
      console.error("togglePin failed:", err);
    }
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, selectedChannelId]);

  const matchesSearch = (label) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return label.toLowerCase().includes(q);
  };

  const filteredPublic = useMemo(
    () => publicChannels.filter((c) => matchesSearch(c.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [publicChannels, search],
  );
  const filteredDms = useMemo(
    () => dmChannels.filter((c) => matchesSearch(displayNameForChannel(c))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dmChannels, search, userIdToName],
  );

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

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const valid = [];
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        alert(`${f.name} is too large (max 25 MB)`);
        continue;
      }
      valid.push({ file: f, previewUrl: isImageType(f.type) ? URL.createObjectURL(f) : null });
    }
    setPendingFiles((prev) => [...prev, ...valid]);
  };

  const removePendingFile = (idx) => {
    setPendingFiles((prev) => {
      const next = [...prev];
      const removed = next.splice(idx, 1);
      if (removed[0]?.previewUrl) URL.revokeObjectURL(removed[0].previewUrl);
      return next;
    });
  };

  const uploadPendingFiles = async (messageId) => {
    if (!pendingFiles.length || !user?.id) return [];
    const uploaded = [];
    for (const { file } of pendingFiles) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${messageId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-attachments")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) {
        console.error("upload failed:", upErr);
        continue;
      }
      const { data: pub } = supabase.storage.from("chat-attachments").getPublicUrl(path);
      const { data: row, error: insErr } = await supabase
        .from("chat_message_attachments")
        .insert({
          message_id: messageId,
          file_name: file.name,
          file_url: pub.publicUrl,
          file_path: path,
          file_type: file.type || null,
          file_size: file.size,
          uploaded_by: user.id,
        })
        .select()
        .single();
      if (insErr) {
        console.error("attachment insert failed:", insErr);
        continue;
      }
      uploaded.push(row);
    }
    return uploaded;
  };

  const handleSend = async () => {
    const body = draft.trim();
    const hasFiles = pendingFiles.length > 0;
    if ((!body && !hasFiles) || !selectedChannelId || !user?.id) return;
    setSubmitting(true);
    setUploadingFiles(hasFiles);
    try {
      const mentioned = extractMentions(body);
      const created = await ChatMessage.create({
        channel_id: selectedChannelId,
        user_id: user.id,
        body: body || (hasFiles ? `📎 ${pendingFiles.length} attachment${pendingFiles.length === 1 ? "" : "s"}` : ""),
        mentioned_user_ids: mentioned,
      });

      let uploaded = [];
      if (hasFiles) {
        uploaded = await uploadPendingFiles(created.id);
        if (uploaded.length) {
          setAttachments((prev) => {
            const next = new Map(prev);
            next.set(created.id, uploaded);
            return next;
          });
        }
        // Clear pending files + revoke blob URLs
        for (const pf of pendingFiles) if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
        setPendingFiles([]);
      }

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
      setUploadingFiles(false);
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
    <div className="flex w-full h-full min-h-0 bg-white">
      {/* Channel list */}
      <aside className="w-64 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Team chat</h2>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="pl-7 h-8 text-sm bg-white"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-1 space-y-3">
          {/* Public channels */}
          <div>
            <div className="flex items-center justify-between px-2.5 pt-1 pb-0.5">
              <span className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">
                Channels
              </span>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="p-0.5 rounded hover:bg-gray-200 text-gray-500"
                title="New channel"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {loading ? (
              <div className="text-xs text-gray-400 px-3 py-1">Loading…</div>
            ) : filteredPublic.length === 0 ? (
              <div className="text-xs text-gray-400 px-3 py-1">
                {search ? "No matches" : "No channels"}
              </div>
            ) : (
              filteredPublic.map((c) => {
                const active = c.id === selectedChannelId;
                const count = unread.get(c.id) || 0;
                const hasUnread = count > 0 && !active;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedChannelId(c.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${
                      active
                        ? "bg-indigo-100 text-indigo-900 font-medium"
                        : hasUnread
                          ? "text-gray-900 font-semibold hover:bg-gray-100"
                          : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate flex-1">{c.name}</span>
                    {hasUnread && (
                      <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Direct messages */}
          <div>
            <div className="flex items-center justify-between px-2.5 pt-1 pb-0.5">
              <span className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">
                Direct Messages
              </span>
              <button
                type="button"
                onClick={() => setShowNewDm(true)}
                className="p-0.5 rounded hover:bg-gray-200 text-gray-500"
                title="New direct message"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {filteredDms.length === 0 ? (
              <div className="text-xs text-gray-400 px-3 py-1">
                {search ? "No matches" : "No direct messages"}
              </div>
            ) : (
              filteredDms.map((c) => {
                const active = c.id === selectedChannelId;
                const name = displayNameForChannel(c);
                const count = unread.get(c.id) || 0;
                const hasUnread = count > 0 && !active;
                const partnerId = dmPartnerId(c);
                const isOnline = partnerId && onlineUserIds.has(partnerId);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedChannelId(c.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm flex items-center gap-2 ${
                      active
                        ? "bg-indigo-100 text-indigo-900 font-medium"
                        : hasUnread
                          ? "text-gray-900 font-semibold hover:bg-gray-100"
                          : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <UserAvatar
                      name={name}
                      imageUrl={userIdToImage[partnerId]}
                      size="xs"
                      online={!!isOnline}
                      ringClass="ring-gray-50"
                    />
                    <span className="truncate flex-1">{name}</span>
                    {hasUnread && (
                      <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* Conversation */}
      <main
        className="flex-1 flex flex-col min-w-0 relative"
        onDragEnter={(e) => {
          if (!selectedChannel) return;
          if (e.dataTransfer?.types?.includes("Files")) {
            e.preventDefault();
            setDragActive(true);
          }
        }}
        onDragOver={(e) => {
          if (!selectedChannel) return;
          if (e.dataTransfer?.types?.includes("Files")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        onDragLeave={(e) => {
          // Only hide overlay when leaving the main element itself
          if (e.currentTarget === e.target) setDragActive(false);
        }}
        onDrop={(e) => {
          if (!selectedChannel) return;
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
        }}
      >
        {dragActive && selectedChannel && (
          <div className="absolute inset-0 z-30 bg-indigo-50/80 border-4 border-dashed border-indigo-400 rounded-md m-2 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Paperclip className="w-10 h-10 mx-auto mb-2 text-indigo-500" />
              <p className="text-lg font-semibold text-indigo-700">Drop files to attach</p>
              <p className="text-sm text-indigo-600">Max 25 MB per file</p>
            </div>
          </div>
        )}
        {!selectedChannel ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Select a channel to start chatting
          </div>
        ) : (
          <>
            <header className="relative border-b border-gray-200 px-5 py-3">
              <div className="flex items-center gap-2">
                {selectedChannel.is_dm ? (
                  <>
                    {(() => {
                      const pid = dmPartnerId(selectedChannel);
                      return (
                        <UserAvatar
                          name={displayNameForChannel(selectedChannel)}
                          imageUrl={userIdToImage[pid]}
                          size="sm"
                          online={pid && onlineUserIds.has(pid)}
                        />
                      );
                    })()}
                    <h1 className="font-semibold text-gray-900">
                      {displayNameForChannel(selectedChannel)}
                    </h1>
                    {(() => {
                      const pid = dmPartnerId(selectedChannel);
                      if (!pid) return null;
                      return onlineUserIds.has(pid) ? (
                        <span className="text-xs text-green-600">• Active</span>
                      ) : (
                        <span className="text-xs text-gray-400">• Offline</span>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <Hash className="w-4 h-4 text-gray-400" />
                    <h1 className="font-semibold text-gray-900">{selectedChannel.name}</h1>
                  </>
                )}
              </div>
              {!selectedChannel.is_dm && selectedChannel.description && (
                <p className="text-xs text-gray-500 mt-0.5 ml-6">{selectedChannel.description}</p>
              )}
              {messages.some((m) => m.is_pinned) && (
                <button
                  type="button"
                  onClick={() => setShowPinned((s) => !s)}
                  className="absolute right-5 top-3 inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 px-2 py-1 rounded hover:bg-amber-50"
                >
                  <Pin className="w-3.5 h-3.5" />
                  <span>{messages.filter((m) => m.is_pinned).length} pinned</span>
                </button>
              )}
            </header>
            {showPinned && messages.some((m) => m.is_pinned) && (
              <div className="border-b border-amber-200 bg-amber-50/60 px-5 py-2 space-y-1 max-h-40 overflow-y-auto">
                {messages
                  .filter((m) => m.is_pinned)
                  .map((m) => {
                    const author = userIdToName[m.user_id] || "Unknown";
                    return (
                      <div key={m.id} className="flex items-start gap-2 text-xs">
                        <Pin className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-900">{author}:</span>{" "}
                          <span className="text-gray-700">
                            {m.body.replace(/@\[([^\]]+)\]\([0-9a-f-]+\)/g, "@$1")}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => togglePin(m)}
                          className="text-gray-400 hover:text-red-600"
                          title="Unpin"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

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
                      <UserAvatar
                        name={author}
                        imageUrl={userIdToImage[g.user_id]}
                        size="lg"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-gray-900">{author}</span>
                          <span className="text-xs text-gray-400">{formatTime(first.created_at)}</span>
                        </div>
                        <div className="space-y-1">
                          {g.messages.map((m) => {
                            const mine = m.user_id === user?.id;
                            const isEditing = editingMessageId === m.id;
                            const msgRx = reactions.get(m.id) || [];
                            // Aggregate reactions by emoji
                            const rxAgg = new Map();
                            for (const r of msgRx) {
                              const existing = rxAgg.get(r.emoji) || { count: 0, mine: false };
                              existing.count += 1;
                              if (r.user_id === user?.id) existing.mine = true;
                              rxAgg.set(r.emoji, existing);
                            }
                            return (
                              <div
                                key={m.id}
                                className={`group relative flex items-start gap-2 -mx-2 px-2 py-0.5 rounded ${
                                  m.is_pinned ? "bg-amber-50/50" : "hover:bg-gray-50"
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  {m.is_pinned && (
                                    <div className="flex items-center gap-1 text-[11px] text-amber-700 mb-0.5">
                                      <Pin className="w-3 h-3" />
                                      <span>Pinned</span>
                                    </div>
                                  )}
                                  {isEditing ? (
                                    <div className="space-y-1.5">
                                      <Textarea
                                        value={editDraft}
                                        onChange={(e) => setEditDraft(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Escape") {
                                            e.preventDefault();
                                            cancelEdit();
                                          } else if (
                                            e.key === "Enter" &&
                                            !e.shiftKey &&
                                            !e.metaKey &&
                                            !e.ctrlKey
                                          ) {
                                            e.preventDefault();
                                            saveEdit();
                                          }
                                        }}
                                        rows={2}
                                        className="resize-none text-sm"
                                        autoFocus
                                      />
                                      <div className="flex gap-2 text-xs text-gray-500">
                                        <button
                                          type="button"
                                          onClick={saveEdit}
                                          className="px-2 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={cancelEdit}
                                          className="px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-100"
                                        >
                                          Cancel
                                        </button>
                                        <span className="self-center">Enter to save · Esc to cancel</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                                        {renderBody(m.body, userIdToName)}
                                        {m.edited_at && (
                                          <span className="ml-1 text-[11px] text-gray-400">(edited)</span>
                                        )}
                                      </div>
                                      {(() => {
                                        const atts = attachments.get(m.id) || [];
                                        if (!atts.length) return null;
                                        const images = atts.filter((a) => isImageType(a.file_type));
                                        const files = atts.filter((a) => !isImageType(a.file_type));
                                        return (
                                          <div className="mt-2 space-y-2">
                                            {images.length > 0 && (
                                              <div className="flex flex-wrap gap-2">
                                                {images.map((a) => (
                                                  <a
                                                    key={a.id}
                                                    href={a.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block"
                                                  >
                                                    <img
                                                      src={a.file_url}
                                                      alt={a.file_name}
                                                      className="max-w-[240px] max-h-[240px] rounded-md border border-gray-200 hover:border-gray-300 transition-colors"
                                                    />
                                                  </a>
                                                ))}
                                              </div>
                                            )}
                                            {files.map((a) => (
                                              <a
                                                key={a.id}
                                                href={a.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-md pl-2 pr-3 py-1.5 hover:border-gray-300 hover:bg-gray-50 transition-colors max-w-[280px]"
                                                download={a.file_name}
                                              >
                                                <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                  <div className="text-[12px] text-gray-900 truncate">{a.file_name}</div>
                                                  <div className="text-[10px] text-gray-500">{formatFileSize(a.file_size)}</div>
                                                </div>
                                                <Download className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                              </a>
                                            ))}
                                          </div>
                                        );
                                      })()}
                                      {rxAgg.size > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          {Array.from(rxAgg.entries()).map(([emoji, info]) => (
                                            <button
                                              key={emoji}
                                              type="button"
                                              onClick={() => toggleReaction(m.id, emoji)}
                                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xs ${
                                                info.mine
                                                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                                                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                              }`}
                                            >
                                              <span>{emoji}</span>
                                              <span className="tabular-nums font-medium">{info.count}</span>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                                {!isEditing && (
                                  <div className="opacity-0 group-hover:opacity-100 absolute right-2 -top-3 flex items-center bg-white border border-gray-200 rounded-md shadow-sm">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setReactionPickerFor(
                                          reactionPickerFor === m.id ? null : m.id,
                                        )
                                      }
                                      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-l-md"
                                      title="Add reaction"
                                    >
                                      <Smile className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => togglePin(m)}
                                      className={`p-1.5 hover:bg-gray-50 ${
                                        m.is_pinned ? "text-amber-600" : "text-gray-500 hover:text-gray-700"
                                      }`}
                                      title={m.is_pinned ? "Unpin" : "Pin"}
                                    >
                                      <Pin className="w-3.5 h-3.5" />
                                    </button>
                                    {mine && (
                                      <button
                                        type="button"
                                        onClick={() => startEdit(m)}
                                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                        title="Edit"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {mine && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteMessage(m)}
                                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-50 rounded-r-md"
                                        title="Delete"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                                {reactionPickerFor === m.id && (
                                  <div className="absolute right-2 top-6 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-1 flex gap-0.5">
                                    {QUICK_REACTIONS.map((e) => (
                                      <button
                                        key={e}
                                        type="button"
                                        onClick={() => toggleReaction(m.id, e)}
                                        className="text-lg hover:bg-gray-100 rounded w-8 h-8 flex items-center justify-center"
                                      >
                                        {e}
                                      </button>
                                    ))}
                                  </div>
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
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {pendingFiles.map((pf, idx) => (
                    <div key={idx} className="relative group flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md pl-2 pr-8 py-1.5 max-w-[240px]">
                      {pf.previewUrl ? (
                        <img src={pf.previewUrl} alt="" className="w-8 h-8 object-cover rounded flex-shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-gray-900 truncate">{pf.file.name}</div>
                        <div className="text-[10px] text-gray-500">{formatFileSize(pf.file.size)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePendingFile(idx)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800"
                        title="Remove"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="relative">
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={handleDraftChange}
                  onKeyDown={handleKeyDown}
                  onPaste={(e) => {
                    const files = Array.from(e.clipboardData?.files || []);
                    if (files.length) {
                      e.preventDefault();
                      addFiles(files);
                    }
                  }}
                  placeholder={
                    selectedChannel.is_dm
                      ? `Message ${displayNameForChannel(selectedChannel)}`
                      : `Message #${selectedChannel.name}`
                  }
                  rows={2}
                  className="resize-none pr-20 pl-10"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute left-2 bottom-2 p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  title="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
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
                        <UserAvatar name={u.name} imageUrl={userIdToImage[u.id]} size="sm" />
                        <span className="truncate">{u.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={(!draft.trim() && pendingFiles.length === 0) || submitting}
                  className="absolute right-2 bottom-2 p-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Send (Enter)"
                >
                  {submitting || uploadingFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 ml-1">
                Enter to send · Shift+Enter for new line · @ to mention · drop or paste files
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

      <NewDmDialog
        open={showNewDm}
        onOpenChange={setShowNewDm}
        teamMembers={teamMembers}
        existingDms={dmChannels}
        onlineUserIds={onlineUserIds}
        onOpened={(channel) => {
          setChannels((prev) =>
            prev.find((c) => c.id === channel.id) ? prev : [...prev, channel],
          );
          setSelectedChannelId(channel.id);
          setShowNewDm(false);
        }}
      />
    </div>
  );
}

function NewDmDialog({ open, onOpenChange, teamMembers, existingDms, onlineUserIds, onOpened }) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teamMembers
      .filter((tm) => tm.status === "active" && tm.user_id && tm.user_id !== user?.id)
      .filter((tm) => !q || tm.full_name.toLowerCase().includes(q))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [teamMembers, query, user?.id]);

  const openWithUser = async (otherUserId) => {
    if (!user?.id || !otherUserId) return;
    setSubmitting(true);
    setError("");
    try {
      const pair = [user.id, otherUserId].sort();
      // 1. Look for an existing DM in already-loaded list
      const preloaded = existingDms.find(
        (c) =>
          c.dm_user_ids.length === 2 &&
          c.dm_user_ids.includes(pair[0]) &&
          c.dm_user_ids.includes(pair[1]),
      );
      if (preloaded) {
        onOpened(preloaded);
        return;
      }
      // 2. Server lookup (RLS lets us see DMs we're in)
      const { data: existing, error: selErr } = await supabase
        .from("chat_channels")
        .select("id, name, description, is_archived, is_dm, dm_user_ids, created_by, created_at, updated_at")
        .eq("is_dm", true)
        .contains("dm_user_ids", pair)
        .limit(1);
      if (selErr) throw selErr;
      if (existing && existing.length > 0) {
        onOpened(existing[0]);
        return;
      }
      // 3. Create
      const { data: created, error: insErr } = await supabase
        .from("chat_channels")
        .insert({
          name: `dm-${pair[0].slice(0, 4)}-${pair[1].slice(0, 4)}`,
          is_dm: true,
          dm_user_ids: pair,
          created_by: user.id,
        })
        .select()
        .single();
      if (insErr) throw insErr;
      onOpened(created);
    } catch (err) {
      console.error("open DM failed:", err);
      setError(err.message || "Failed to open DM");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New direct message</DialogTitle>
          <DialogDescription>
            Start a private conversation with a teammate.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teammates"
              className="pl-8"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
            {candidates.length === 0 ? (
              <div className="text-xs text-gray-400 px-3 py-4 text-center">
                {query ? "No matches" : "No teammates available"}
              </div>
            ) : (
              candidates.map((tm) => {
                const isOnline = onlineUserIds?.has(tm.user_id);
                return (
                  <button
                    key={tm.id}
                    type="button"
                    onClick={() => openWithUser(tm.user_id)}
                    disabled={submitting}
                    className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-gray-50 disabled:opacity-60"
                  >
                    <UserAvatar
                      name={tm.full_name}
                      imageUrl={tm.profile_image_url}
                      size="md"
                      online={!!isOnline}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-900 truncate">{tm.full_name}</div>
                      {tm.role && (
                        <div className="text-xs text-gray-400 truncate">{tm.role}</div>
                      )}
                    </div>
                    <MessageCircle className="w-4 h-4 text-gray-300 shrink-0" />
                  </button>
                );
              })
            )}
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
      </DialogContent>
    </Dialog>
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
