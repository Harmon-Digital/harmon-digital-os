import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Task,
  Project,
  Account,
  Contact,
  ChatChannel,
  TeamMember,
} from "@/api/entities";
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
  Briefcase,
  ArrowRight,
  Settings,
  Users as UsersIcon,
} from "lucide-react";

const NAV_LINKS = [
  { name: "Dashboard", path: "/Dashboard", icon: LayoutDashboard, keywords: "home overview" },
  { name: "Projects", path: "/Projects", icon: FolderKanban },
  { name: "Tasks", path: "/Tasks", icon: CheckSquare, keywords: "todo" },
  { name: "Chat", path: "/Channels", icon: Hash, keywords: "channels dms slack messages team" },
  { name: "Time Tracking", path: "/TimeTracking", icon: Clock, keywords: "timesheet hours" },
  { name: "Social Media", path: "/SocialMedia", icon: Calendar, keywords: "posts" },
  { name: "CRM", path: "/CRM", icon: Target, keywords: "leads pipeline" },
  { name: "Accounts", path: "/Accounts", icon: Building2, keywords: "clients" },
  { name: "Contacts", path: "/Contacts", icon: UserCircle, keywords: "people" },
  { name: "SOPs", path: "/SOPs", icon: FileText, keywords: "procedures docs" },
  { name: "Reports", path: "/Reports", icon: BarChart3, keywords: "analytics accounting" },
  { name: "KPIs", path: "/KPIs", icon: Target, keywords: "metrics goals" },
  { name: "Team", path: "/Team", icon: UsersIcon },
  { name: "Branding", path: "/Branding", icon: Building2 },
  { name: "Settings", path: "/PersonalSettings", icon: Settings, keywords: "profile preferences" },
  { name: "API Keys", path: "/McpApiKeys", icon: KeyRound, keywords: "mcp" },
];

const RECENT_KEY = "hdo.cmdk.recent";

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecent(item) {
  if (!item) return;
  try {
    const cur = loadRecent();
    const dedup = [item, ...cur.filter((x) => x.key !== item.key)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(dedup));
  } catch {}
}

export default function CommandPalette() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(loadRecent);

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Global ⌘K
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

  // Lazy-load on first open
  useEffect(() => {
    if (!open || loaded) return;
    const load = async () => {
      try {
        const [ts, ps, accs, cts, chs, tms] = await Promise.all([
          Task.list("-created_at").catch(() => []),
          Project.list().catch(() => []),
          Account.list().catch(() => []),
          Contact.list().catch(() => []),
          ChatChannel.filter({ is_archived: false }, "created_at").catch(() => []),
          TeamMember.list().catch(() => []),
        ]);
        setTasks((ts || []).slice(0, 200));
        setProjects(ps || []);
        setAccounts(accs || []);
        setContacts(cts || []);
        setChannels(chs || []);
        setTeamMembers(tms || []);
        setLoaded(true);
      } catch (err) {
        console.error("Command palette load failed:", err);
      }
    };
    load();
  }, [open, loaded]);

  const go = useCallback(
    (path, recentItem) => {
      setOpen(false);
      setQuery("");
      if (recentItem) {
        saveRecent(recentItem);
        setRecent(loadRecent());
      }
      navigate(path);
    },
    [navigate],
  );

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

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === "active").slice(0, 30),
    [projects],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search tasks, projects, people, channels — or jump anywhere"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        {recent.length > 0 && !query && (
          <>
            <CommandGroup heading="Recent">
              {recent.map((r) => {
                const Icon = r.iconKey === "task" ? CheckSquare
                  : r.iconKey === "project" ? Briefcase
                  : r.iconKey === "channel" ? Hash
                  : r.iconKey === "dm" ? MessageCircle
                  : r.iconKey === "account" ? Building2
                  : r.iconKey === "contact" ? UserCircle
                  : ArrowRight;
                return (
                  <CommandItem key={r.key} value={`recent ${r.label}`} onSelect={() => go(r.path, r)}>
                    <Icon className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="truncate">{r.label}</span>
                    <CommandShortcut className="text-[10px]">{r.kindLabel}</CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Quick actions">
          <CommandItem value="action new task" onSelect={() => go("/Tasks?new=1")}>
            <Plus className="mr-2 h-4 w-4 text-gray-500" />
            <span>New task</span>
            <CommandShortcut>⇧N</CommandShortcut>
          </CommandItem>
          <CommandItem value="action log time" onSelect={() => go("/TimeTracking?new=1")}>
            <Clock className="mr-2 h-4 w-4 text-gray-500" />
            <span>Log time</span>
            <CommandShortcut>T</CommandShortcut>
          </CommandItem>
          <CommandItem value="action new project" onSelect={() => go("/Projects?new=1")}>
            <Briefcase className="mr-2 h-4 w-4 text-gray-500" />
            <span>New project</span>
          </CommandItem>
          <CommandItem value="action new channel" onSelect={() => go("/Channels?new=1")}>
            <Plus className="mr-2 h-4 w-4 text-gray-500" />
            <span>New channel</span>
          </CommandItem>
          <CommandItem value="action new dm" onSelect={() => go("/Channels?dm=1")}>
            <MessageCircle className="mr-2 h-4 w-4 text-gray-500" />
            <span>New direct message</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Pages">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <CommandItem
                key={link.path}
                value={`page ${link.name} ${link.keywords || ""}`}
                onSelect={() => go(link.path, { key: `page:${link.path}`, label: link.name, path: link.path, iconKey: "page", kindLabel: "Page" })}
              >
                <Icon className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <span>{link.name}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {activeProjects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {activeProjects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`project ${p.name}`}
                  onSelect={() => go(`/ProjectDetail?id=${p.id}`, { key: `project:${p.id}`, label: p.name, path: `/ProjectDetail?id=${p.id}`, iconKey: "project", kindLabel: "Project" })}
                >
                  <Briefcase className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <span className="truncate">{p.name}</span>
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
                  onSelect={() => go(`/Tasks?taskId=${t.id}`, { key: `task:${t.id}`, label: t.title, path: `/Tasks?taskId=${t.id}`, iconKey: "task", kindLabel: "Task" })}
                >
                  <CheckSquare className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <span className="truncate">{t.title}</span>
                  {t.status && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      {t.status.replace("_", " ")}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {publicChannels.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Channels">
              {publicChannels.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`channel ${c.name} ${c.description || ""}`}
                  onSelect={() => go(`/Channels?channelId=${c.id}`, { key: `channel:${c.id}`, label: `#${c.name}`, path: `/Channels?channelId=${c.id}`, iconKey: "channel", kindLabel: "Channel" })}
                >
                  <Hash className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-500" />
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
                  onSelect={() => go(`/Channels?channelId=${c.id}`, { key: `dm:${c.id}`, label: c._displayName, path: `/Channels?channelId=${c.id}`, iconKey: "dm", kindLabel: "DM" })}
                >
                  <MessageCircle className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <span>{c._displayName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {accounts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Accounts">
              {accounts.slice(0, 30).map((a) => (
                <CommandItem
                  key={a.id}
                  value={`account ${a.company_name || a.name || ""}`}
                  onSelect={() => go(`/Accounts?id=${a.id}`, { key: `account:${a.id}`, label: a.company_name || a.name, path: `/Accounts?id=${a.id}`, iconKey: "account", kindLabel: "Account" })}
                >
                  <Building2 className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <span className="truncate">{a.company_name || a.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {contacts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Contacts">
              {contacts.slice(0, 30).map((c) => {
                const name = `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email || "Contact";
                return (
                  <CommandItem
                    key={c.id}
                    value={`contact ${name} ${c.email || ""}`}
                    onSelect={() => go(`/Contacts?id=${c.id}`, { key: `contact:${c.id}`, label: name, path: `/Contacts?id=${c.id}`, iconKey: "contact", kindLabel: "Contact" })}
                  >
                    <UserCircle className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="truncate">{name}</span>
                    {c.email && (
                      <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[160px]">{c.email}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
