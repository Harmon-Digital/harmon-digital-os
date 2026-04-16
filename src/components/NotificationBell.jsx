import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Bell, CheckCheck, Inbox, Settings } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import NotificationItem from "./NotificationItem";

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all"); // all | unread | <category>

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setNotifications(data || []);
    } catch (err) {
      console.error("Notification load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Supabase Realtime subscription instead of polling
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => {
            if (payload.eventType === "INSERT") {
              if (prev.find((n) => n.id === payload.new.id)) return prev;
              return [payload.new, ...prev].slice(0, 100);
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((n) => (n.id === payload.new.id ? { ...n, ...payload.new } : n));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((n) => n.id !== payload.old.id);
            }
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const markAsRead = useCallback(async (id) => {
    // Optimistic
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
    } catch (err) {
      console.error("markAsRead failed:", err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
    } catch (err) {
      console.error("markAllAsRead failed:", err);
    }
  }, [notifications, user?.id]);

  const removeNotification = useCallback(async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await supabase.from("notifications").delete().eq("id", id);
    } catch (err) {
      console.error("delete failed:", err);
    }
  }, []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const categories = useMemo(
    () => Array.from(new Set(notifications.map((n) => n.category).filter(Boolean))),
    [notifications],
  );
  const filtered = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.read);
    if (filter === "all") return notifications;
    return notifications.filter((n) => n.category === filter);
  }, [filter, notifications]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative size-9 flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-white/5 dark:hover:bg-white/10 transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold ring-2 ring-[#0b0b0d]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0 overflow-hidden"
        align="end"
        side="right"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 h-10 border-b border-gray-200 dark:border-gray-800">
          <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Inbox</span>
          {unreadCount > 0 && (
            <span className="text-[11px] text-gray-500 tabular-nums">{unreadCount} unread</span>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-40 disabled:cursor-not-allowed px-1.5 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Mark all as read"
          >
            <CheckCheck className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Segmented filter */}
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
          <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </FilterPill>
          <FilterPill active={filter === "unread"} onClick={() => setFilter("unread")}>
            Unread
            {unreadCount > 0 && (
              <span className="ml-1 text-[10px] tabular-nums opacity-80">{unreadCount}</span>
            )}
          </FilterPill>
          {categories.map((cat) => (
            <FilterPill key={cat} active={filter === cat} onClick={() => setFilter(cat)}>
              <span className="capitalize">{cat}</span>
            </FilterPill>
          ))}
        </div>

        {/* List */}
        <div className="max-h-[420px] overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-[12px] text-gray-400 dark:text-gray-500">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Inbox className="w-6 h-6 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <p className="text-[13px] text-gray-500 dark:text-gray-400">
                {filter === "unread" ? "Inbox zero" : "No notifications"}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                {filter === "unread" ? "You're all caught up." : "We'll let you know when something happens."}
              </p>
            </div>
          ) : (
            filtered.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onMarkAsRead={markAsRead}
                onDelete={removeNotification}
                onClose={() => setOpen(false)}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 h-6 rounded-md text-[12px] transition-colors shrink-0 ${
        active
          ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      {children}
    </button>
  );
}
