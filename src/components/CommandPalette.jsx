import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Task, ChatChannel, TeamMember } from "@/api/entities";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Clock,
  Hash,
  MessageCircle,
  Target,
  UserCircle,
  Building2,
  FileText,
  Calendar,
  KeyRound,
  BarChart3,
  Plus,
} from "lucide-react";

const NAV_LINKS = [
  { name: "Dashboard", path: "/Dashboard", icon: LayoutDashboard, keywords: "home overview" },
  { name: "Projects", path: "/Projects", icon: FolderKanban, keywords: "" },
  { name: "Tasks", path: "/Tasks", icon: CheckSquare, keywords: "todo" },
  { name: "Chat", path: "/Channels", icon: Hash, keywords: "channels dms slack messages team" },
  { name: "Time Tracking", path: "/TimeTracking", icon: Clock, keywords: "timesheet hours" },
  { name: "SOPs", path: "/SOPs", icon: FileText, keywords: "procedures docs" },
  { name: "Branding", path: "/Branding", icon: Building2, keywords: "" },
  { name: "CRM", path: "/CRM", icon: Target, keywords: "leads" },
  { name: "Accounts", path: "/Accounts", icon: Building2, keywords: "clients" },
  { name: "Contacts", path: "/Contacts", icon: UserCircle, keywords: "people" },
  { name: "Social Media", path: "/SocialMedia", icon: Calendar, keywords: "posts" },
  { name: "Reports", path: "/Reports", icon: BarChart3, keywords: "analytics" },
  { name: "API Keys", path: "/McpApiKeys", icon: KeyRound, keywords: "mcp" },
];

export default function CommandPalette() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const [tasks, setTasks] = useState([]);
  const [channels, setChannels] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Global keyboard shortcut
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lazy-load searchable content the first time the palette opens
  useEffect(() => {
    if (!open || loaded) return;
    const load = async () => {
      try {
        const [ts, chs, tms] = await Promise.all([
          Task.list("-created_at").catch(() => []),
          ChatChannel.filter({ is_archived: false }, "created_at").catch(() => []),
          TeamMember.list().catch(() => []),
        ]);
        setTasks((ts || []).slice(0, 200));
        setChannels(chs || []);
        setTeamMembers(tms || []);
        setLoaded(true);
      } catch (err) {
        console.error("Command palette load failed:", err);
      }
    };
    load();
  }, [open, loaded]);

  const go = (path) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  };

  // Derive DMs for current user & display names
  const userIdToName = useMemo(() => {
    const m = {};
    for (const tm of teamMembers) if (tm.user_id) m[tm.user_id] = tm.full_name;
    return m;
  }, [teamMembers]);

  const publicChannels = useMemo(
    () => channels.filter((c) => !c.is_dm).slice(0, 10),
    [channels],
  );
  const myDms = useMemo(
    () =>
      channels
        .filter((c) => c.is_dm && user?.id && (c.dm_user_ids || []).includes(user.id))
        .map((c) => {
          const other = (c.dm_user_ids || []).find((id) => id !== user.id);
          return { ...c, _displayName: userIdToName[other] || "Direct message" };
        })
        .slice(0, 10),
    [channels, user?.id, userIdToName],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search tasks, channels, people, or jump to a page…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Quick actions">
          <CommandItem
            value="new-task create-task"
            onSelect={() => go("/Tasks")}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>New task</span>
          </CommandItem>
          <CommandItem value="new-channel create-channel" onSelect={() => go("/Channels")}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New channel</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Pages">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <CommandItem
                key={link.path}
                value={`${link.name} ${link.keywords}`}
                onSelect={() => go(link.path)}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{link.name}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {publicChannels.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Channels">
              {publicChannels.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`#${c.name} ${c.description || ""}`}
                  onSelect={() => go(`/Channels`)}
                >
                  <Hash className="mr-2 h-4 w-4 text-gray-400" />
                  <span>{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {myDms.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Direct messages">
              {myDms.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`dm ${c._displayName}`}
                  onSelect={() => go(`/Channels`)}
                >
                  <MessageCircle className="mr-2 h-4 w-4 text-gray-400" />
                  <span>{c._displayName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {tasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tasks">
              {tasks.slice(0, 50).map((t) => (
                <CommandItem
                  key={t.id}
                  value={`task ${t.title} ${t.status || ""}`}
                  onSelect={() => go(`/Tasks`)}
                >
                  <CheckSquare className="mr-2 h-4 w-4 text-gray-400" />
                  <span className="truncate">{t.title}</span>
                  {t.status && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-400">
                      {t.status.replace("_", " ")}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
