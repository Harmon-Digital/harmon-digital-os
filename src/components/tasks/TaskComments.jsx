import React, { useEffect, useMemo, useRef, useState } from "react";
import { TaskComment } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { sendNotification } from "@/api/functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import UserAvatar from "@/components/ui/UserAvatar";
import { MessageSquare, Send, Trash2, Loader2 } from "lucide-react";

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

// Render comment body with @mentions highlighted
function renderBody(body, mentionNameById) {
  if (!body) return null;
  const parts = [];
  const regex = /@\[([^\]]+)\]\(([0-9a-f-]+)\)/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{body.slice(lastIndex, match.index)}</span>);
    }
    const [, name, id] = match;
    const displayName = mentionNameById?.[id] || name;
    parts.push(
      <span
        key={key++}
        className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[13px] font-medium"
      >
        @{displayName}
      </span>,
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < body.length) {
    parts.push(<span key={key++}>{body.slice(lastIndex)}</span>);
  }
  return parts;
}

export default function TaskComments({ taskId, task, teamMembers = [], projectsMap = {} }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState("");
  const [authorMap, setAuthorMap] = useState({});
  const [avatarMap, setAvatarMap] = useState({});
  const [mentionQuery, setMentionQuery] = useState(null); // { start, query } or null
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef(null);

  // Map of team_member user_id -> full_name, for rendering mention chips
  const userIdToName = useMemo(() => {
    const m = {};
    for (const tm of teamMembers) {
      if (tm.user_id) m[tm.user_id] = tm.full_name;
    }
    for (const [id, name] of Object.entries(authorMap)) {
      if (!m[id]) m[id] = name;
    }
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

  const load = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const data = await TaskComment.filter({ task_id: taskId }, "created_at");
      setComments(data || []);

      // Pull author names + avatars in bulk
      const missingIds = Array.from(
        new Set((data || []).map((c) => c.user_id).filter((id) => id && !userIdToName[id])),
      );
      if (missingIds.length > 0) {
        const [{ data: profiles }, { data: tms }] = await Promise.all([
          supabase
            .from("user_profiles")
            .select("id, full_name, email")
            .in("id", missingIds),
          supabase
            .from("team_members")
            .select("user_id, full_name, profile_image_url")
            .in("user_id", missingIds),
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
      console.error("Error loading comments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) load();
    else setComments([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Detect @mention trigger from the current caret position
  const handleDraftChange = (e) => {
    const val = e.target.value;
    const caret = e.target.selectionStart ?? val.length;
    setDraft(val);

    // Look backward from caret for "@..." without spaces/newlines
    const before = val.slice(0, caret);
    const atIdx = Math.max(before.lastIndexOf("@"), -1);
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
    return mentionableUsers
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 6);
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
    // Submit with Cmd/Ctrl+Enter
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const extractMentions = (body) => {
    const ids = new Set();
    const regex = /@\[[^\]]+\]\(([0-9a-f-]+)\)/g;
    let m;
    while ((m = regex.exec(body)) !== null) ids.add(m[1]);
    return Array.from(ids);
  };

  const handleSubmit = async () => {
    const body = draft.trim();
    if (!body || !taskId || !user?.id) return;
    setSubmitting(true);
    try {
      const mentioned = extractMentions(body);
      const created = await TaskComment.create({
        task_id: taskId,
        user_id: user.id,
        body,
        mentioned_user_ids: mentioned,
      });
      setComments((prev) => [...prev, created]);
      setDraft("");
      setMentionQuery(null);

      // Notify mentioned users (skip self)
      if (mentioned.length > 0 && task) {
        const project = projectsMap?.[task.project_id];
        const link = `/Tasks`;
        for (const uid of mentioned) {
          if (uid === user.id) continue;
          try {
            await sendNotification({
              userId: uid,
              type: "info",
              category: "tasks",
              priority: "high",
              source: "tasks.comment_mention",
              title: "You were mentioned in a task",
              message: `"${task.title}"${project ? ` on ${project.name}` : ""}`,
              link,
            });
          } catch (err) {
            console.error("mention notify failed:", err);
          }
        }
      }
    } catch (err) {
      console.error("Error posting comment:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await TaskComment.delete(c.id);
      setComments((prev) => prev.filter((x) => x.id !== c.id));
    } catch (err) {
      console.error("delete failed:", err);
    }
  };

  if (!taskId) {
    return (
      <div className="text-xs text-gray-400 italic">
        Comments will be available after you save this task.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
        Comments
        {comments.length > 0 && (
          <span className="text-xs text-gray-400 font-normal">({comments.length})</span>
        )}
      </Label>

      {loading ? (
        <div className="text-xs text-gray-400 px-1 py-2">Loading…</div>
      ) : comments.length === 0 ? (
        <div className="text-sm text-gray-400 italic px-1 py-2">No comments yet</div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const author = userIdToName[c.user_id] || "Unknown";
            const isMine = c.user_id === user?.id;
            return (
              <li key={c.id} className="flex gap-2.5">
                <UserAvatar name={author} imageUrl={userIdToImage[c.user_id]} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-gray-900">{author}</span>
                    <span className="text-xs text-gray-400">{formatTime(c.created_at)}</span>
                    {isMine && (
                      <button
                        type="button"
                        onClick={() => handleDelete(c)}
                        className="ml-auto p-1 text-gray-400 hover:text-red-600 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                    {renderBody(c.body, userIdToName)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Compose */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={handleDraftChange}
          onKeyDown={handleKeyDown}
          placeholder="Write a comment… (@ to mention, ⌘/Ctrl+Enter to post)"
          rows={3}
          className="resize-none"
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
                <UserAvatar name={u.name} imageUrl={userIdToImage[u.id]} size="sm" />
                <span className="truncate">{u.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!draft.trim() || submitting}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 mr-1.5" />
            )}
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}
