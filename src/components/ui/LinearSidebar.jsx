"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import AgentChatPanel from "@/components/chat/AgentChatPanel";
import NotificationBell from "@/components/NotificationBell";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Clock,
  FileText,
  Building2,
  Target,
  Briefcase,
  UserCircle,
  Calendar,
  Hash,
  UsersRound,
  DollarSign,
  BarChart3,
  TrendingUp,
  Handshake,
  Receipt,
  KeyRound,
  Search,
  ChevronRight,
  LogOut,
  Settings,
  Menu,
  X,
  Sparkles,
  PanelLeft,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CHAT_PANEL_WIDTH = 380;
const COLLAPSED_KEY = "harmon-sidebar-collapsed";

/* -------------------------------------------------------------------------- */
/* Nav model                                                                  */
/* -------------------------------------------------------------------------- */

function buildGroups(user) {
  const isAdmin = user?.role === "admin";
  const groups = [
    {
      id: "workspace",
      label: "Workspace",
      items: [
        { icon: LayoutDashboard, label: "Dashboard", path: "Dashboard" },
        { icon: FolderKanban, label: "Projects", path: "Projects" },
        { icon: CheckSquare, label: "Tasks", path: "Tasks" },
        { icon: Hash, label: "Chat", path: "Channels" },
        { icon: Clock, label: "Time Tracking", path: "TimeTracking" },
        { icon: Calendar, label: "Social Media", path: "SocialMedia" },
      ],
    },
    {
      id: "sales",
      label: "Sales",
      items: [
        { icon: Target, label: "CRM", path: "CRM" },
        { icon: Briefcase, label: "Brokers", path: "BrokerOutreach" },
        { icon: Building2, label: "Accounts", path: "Accounts" },
        { icon: UserCircle, label: "Contacts", path: "Contacts" },
      ],
    },
  ];

  if (isAdmin) {
    groups.push({
      id: "admin",
      label: "Admin",
      items: [
        { icon: LayoutDashboard, label: "Dashboard", path: "AdminDashboard" },
        { icon: UsersRound, label: "Team", path: "Team" },
        { icon: DollarSign, label: "Accounting", path: "AccountingDashboard" },
        { icon: BarChart3, label: "Reports", path: "Reports" },
        { icon: TrendingUp, label: "KPIs", path: "KPIs" },
        { icon: Handshake, label: "Partners", path: "Partners" },
        { icon: Receipt, label: "Referral Payouts", path: "ReferralPayouts" },
        { icon: FileText, label: "SOPs", path: "SOPs" },
        { icon: Building2, label: "Branding", path: "Branding" },
        { icon: KeyRound, label: "API Keys", path: "McpApiKeys" },
      ],
    });
  }

  return groups;
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function WorkspaceSwitcher({ collapsed, onToggleCollapse, onHomeClick }) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 px-1 py-2.5">
        <button
          type="button"
          onClick={onHomeClick}
          title="Harmon Digital OS"
          className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-white/5"
        >
          <div className="w-5 h-5 rounded overflow-hidden shrink-0">
            <img src="/logo.png" alt="Harmon Digital OS" className="w-full h-full object-contain" />
          </div>
        </button>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand sidebar (⌘.)"
            aria-label="Expand sidebar"
            className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-500 hover:text-neutral-100 hover:bg-white/5"
          >
            <PanelLeft className="w-3.5 h-3.5 rotate-180" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-2 py-2.5">
      <button
        type="button"
        onClick={onHomeClick}
        className="flex-1 min-w-0 flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-white/5 text-left"
        title="Harmon Digital OS"
      >
        <div className="w-5 h-5 rounded overflow-hidden shrink-0">
          <img src="/logo.png" alt="Harmon Digital OS" className="w-full h-full object-contain" />
        </div>
        <span className="text-sm font-medium text-neutral-100 truncate">Harmon Digital</span>
      </button>
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="shrink-0 p-1 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-white/5"
          title="Collapse sidebar (⌘.)"
          aria-label="Collapse sidebar"
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function SearchBar({ onOpenPalette, collapsed }) {
  if (collapsed) {
    return (
      <div className="px-2 pb-1.5">
        <button
          type="button"
          onClick={onOpenPalette}
          className="w-full flex items-center justify-center h-8 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-white/5"
          title="Search (⌘K)"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }
  return (
    <div className="px-2 pb-2">
      <button
        type="button"
        onClick={onOpenPalette}
        className="w-full flex items-center gap-2 h-8 px-2 rounded-md bg-white/[0.04] hover:bg-white/[0.07] text-neutral-400 hover:text-neutral-200 transition-colors text-left"
      >
        <Search className="w-3.5 h-3.5 text-neutral-500" />
        <span className="text-[13px] flex-1">Search</span>
        <kbd className="hidden sm:inline-flex items-center px-1.5 h-5 rounded border border-neutral-700 bg-neutral-900 text-[10px] font-medium text-neutral-500">
          ⌘K
        </kbd>
      </button>
    </div>
  );
}

function NavItem({ item, isActive, onNavigate, collapsed, expandable, isExpanded, onToggleExpanded, children }) {
  const Icon = item.icon;
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => onNavigate(item.path)}
        title={item.label}
        className={`w-full flex items-center justify-center h-8 rounded-md transition-colors ${
          isActive
            ? "bg-white/[0.08] text-neutral-50"
            : "text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.04]"
        }`}
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  }
  return (
    <div>
      <div
        className={`group w-full flex items-center h-7 pr-1 rounded-md text-[13px] transition-colors ${
          isActive
            ? "bg-white/[0.08] text-neutral-50 font-medium"
            : "text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.04]"
        }`}
      >
        <button
          type="button"
          onClick={() => onNavigate(item.path)}
          className="flex-1 flex items-center gap-2 h-full pl-2 text-left min-w-0"
        >
          <Icon
            className={`w-3.5 h-3.5 shrink-0 ${
              isActive ? "text-neutral-100" : "text-neutral-500 group-hover:text-neutral-300"
            }`}
          />
          <span className="flex-1 truncate">{item.label}</span>
        </button>
        {expandable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded?.();
            }}
            className="shrink-0 p-0.5 rounded text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.05]"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <ChevronRight
              className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function SubNavItem({ label, path, isActive, onNavigate }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(path)}
      className={`w-full flex items-center gap-2 h-6 pl-7 pr-2 rounded-md text-[12px] transition-colors ${
        isActive
          ? "bg-white/[0.08] text-neutral-100 font-medium"
          : "text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.04]"
      }`}
      title={label}
    >
      <span className="w-1 h-1 rounded-full bg-current opacity-40 shrink-0" />
      <span className="flex-1 text-left truncate">{label}</span>
    </button>
  );
}

function NavGroup({ group, currentPath, onNavigate, collapsed, isOpen, onToggle, projectItems = [] }) {
  const open = !!isOpen;
  const location = useLocation();
  const onProjectDetail = currentPath === "/ProjectDetail";
  const activeProjectId = onProjectDetail
    ? new URLSearchParams(location.search).get("id")
    : null;
  // Start expanded whenever we're on a ProjectDetail page, so the user
  // sees their current project highlighted in the sidebar.
  const [projectsExpanded, setProjectsExpanded] = useState(onProjectDetail);

  // Auto-expand when entering a ProjectDetail page
  useEffect(() => {
    if (onProjectDetail) setProjectsExpanded(true);
  }, [onProjectDetail, activeProjectId]);

  if (collapsed) {
    return (
      <div className="px-2 space-y-0.5">
        {group.items.map((item) => {
          const itemPath = createPageUrl(item.path);
          const isActive = currentPath === itemPath;
          return (
            <NavItem
              key={item.path}
              item={item}
              isActive={isActive}
              onNavigate={onNavigate}
              collapsed
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="px-2">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-1 h-6 px-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-300"
      >
        <ChevronRight
          className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span>{group.label}</span>
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map((item) => {
            const itemPath = createPageUrl(item.path);
            const isActive = currentPath === itemPath;
            const isProjects = item.path === "Projects" && projectItems.length > 0;
            // Highlight "Projects" when we're on /ProjectDetail too, so the
            // group feels attached to the current project sub-item below.
            const isProjectsActive = isProjects && (isActive || onProjectDetail);
            return isProjects ? (
              <NavItem
                key={item.path}
                item={item}
                isActive={isProjectsActive}
                onNavigate={onNavigate}
                collapsed={false}
                expandable
                isExpanded={projectsExpanded}
                onToggleExpanded={() => setProjectsExpanded((x) => !x)}
              >
                {projectsExpanded && (
                  <div className="mt-0.5 space-y-0.5">
                    {projectItems.map((p) => (
                      <SubNavItem
                        key={p.id}
                        label={p.name}
                        path={`/ProjectDetail?id=${p.id}`}
                        isActive={activeProjectId === p.id}
                        onNavigate={(path) => onNavigate(path, { raw: true })}
                      />
                    ))}
                  </div>
                )}
              </NavItem>
            ) : (
              <NavItem
                key={item.path}
                item={item}
                isActive={isActive}
                onNavigate={onNavigate}
                collapsed={false}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function BottomBar({ user, onLogout, onSettings, onChatToggle, chatOpen, collapsed }) {
  const { theme, setTheme } = useTheme();
  const initials = (user?.full_name || "U")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="border-t border-white/[0.06] px-2 py-2 flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-white/5 min-w-0 flex-1">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[12px] text-neutral-200 truncate">{user?.full_name || "You"}</div>
              </div>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-56">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{user?.full_name || "User"}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSettings} className="cursor-pointer">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-1.5">Theme</div>
            <div className="flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-700 p-0.5">
              {[
                { id: "light", icon: Sun, label: "Light" },
                { id: "dark", icon: Moon, label: "Dark" },
                { id: "system", icon: Monitor, label: "Auto" },
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme(id)}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[11px] ${
                    theme === id ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                  title={label}
                >
                  <Icon className="w-3 h-3" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-600 focus:text-red-600">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {!collapsed && (
        <>
          <div className="shrink-0">
            <NotificationBell />
          </div>
          <button
            type="button"
            onClick={onChatToggle}
            className={`shrink-0 p-1.5 rounded-md transition-colors ${
              chatOpen
                ? "bg-indigo-500/15 text-indigo-300"
                : "text-neutral-500 hover:text-neutral-200 hover:bg-white/5"
            }`}
            title="Agent Chat (⌘\\)"
            aria-label="Toggle agent chat"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sidebar container                                                          */
/* -------------------------------------------------------------------------- */

function SidebarBody({
  user,
  collapsed,
  onToggleCollapse,
  onLogout,
  onSettings,
  onChatToggle,
  chatOpen,
  onOpenPalette,
  currentPath,
  onNavigate,
  hideCollapseToggle = false,
  projectItems = [],
}) {
  const groups = useMemo(() => buildGroups(user), [user]);

  // Accordion: at most one group open at a time. Defaults to whichever
  // group contains the current route (so the active page stays visible),
  // or all-closed if no match.
  const groupForPath = useMemo(() => {
    for (const g of groups) {
      for (const item of g.items) {
        if (createPageUrl(item.path) === currentPath) return g.id;
      }
    }
    // ProjectDetail isn't a top-level nav item, but it belongs to the
    // Workspace group via the Projects dropdown.
    if (currentPath === "/ProjectDetail") return "workspace";
    return null;
  }, [groups, currentPath]);

  const [openGroupId, setOpenGroupId] = useState(groupForPath);
  const [userInteracted, setUserInteracted] = useState(false);

  // When route changes, auto-switch to the group of the new route —
  // unless the user has manually opened/closed groups this session.
  useEffect(() => {
    if (!userInteracted && groupForPath !== openGroupId) {
      setOpenGroupId(groupForPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupForPath]);

  const handleToggleGroup = (id) => {
    setUserInteracted(true);
    setOpenGroupId((current) => (current === id ? null : id));
  };

  return (
    <div className="flex flex-col h-full bg-[#0e0e10] border-r border-white/[0.06]">
      <WorkspaceSwitcher
        collapsed={collapsed}
        onToggleCollapse={hideCollapseToggle ? null : onToggleCollapse}
        onHomeClick={() => onNavigate("Dashboard")}
      />
      <SearchBar onOpenPalette={onOpenPalette} collapsed={collapsed} />
      <nav
        className="flex-1 overflow-y-auto py-1 space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {groups.map((g) => (
          <NavGroup
            key={g.id}
            group={g}
            currentPath={currentPath}
            onNavigate={onNavigate}
            collapsed={collapsed}
            isOpen={openGroupId === g.id}
            onToggle={() => handleToggleGroup(g.id)}
            projectItems={g.id === "workspace" ? projectItems : []}
          />
        ))}
      </nav>
      <BottomBar
        user={user}
        onLogout={onLogout}
        onSettings={onSettings}
        onChatToggle={onChatToggle}
        chatOpen={chatOpen}
        collapsed={collapsed}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile top bar + slide-in drawer                                           */
/* -------------------------------------------------------------------------- */

function MobileTopBar({ onMenuClick }) {
  return (
    <header className="bg-[#0e0e10] border-b border-white/[0.06] flex items-center justify-between px-3 h-12 shrink-0 z-40">
      <button
        type="button"
        onClick={onMenuClick}
        className="flex items-center justify-center size-10 rounded-md text-neutral-400 hover:text-neutral-50 hover:bg-white/5"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="Harmon Digital OS" className="w-5 h-5" />
        <span className="text-sm font-medium text-neutral-100">Harmon Digital</span>
      </div>
      <div className="w-10" aria-hidden="true" />
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Main export                                                                */
/* -------------------------------------------------------------------------- */

export function LinearSidebar({ children }) {
  const { user: authUser, userProfile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [projectItems, setProjectItems] = useState([]);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    supabase
      .from("accounts")
      .select("id,company_name")
      .order("company_name", { ascending: true })
      .then(({ data }) => setAccounts(data || []));
  }, []);

  // Active (non-internal) projects for the sidebar dropdown
  useEffect(() => {
    supabase
      .from("projects")
      .select("id,name,status,is_internal,billing_type")
      .eq("status", "active")
      .order("name", { ascending: true })
      .then(({ data }) => {
        const filtered = (data || []).filter(
          (p) => !p.is_internal && p.billing_type !== "internal",
        );
        setProjectItems(filtered);
      });
  }, []);

  // Keyboard shortcuts: Cmd+\ toggle chat, Cmd+. toggle collapse
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setChatOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Push QuickActions button left when chat is open
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--qa-right",
      chatOpen && !isMobile ? `${CHAT_PANEL_WIDTH + 24}px` : "24px",
    );
  }, [chatOpen, isMobile]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll while mobile drawer or mobile chat overlay is open
  useEffect(() => {
    if (!isMobile) return;
    const shouldLock = mobileMenuOpen || chatOpen;
    if (shouldLock) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isMobile, mobileMenuOpen, chatOpen]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Sign out failed:", err);
    }
    navigate("/login");
  };
  const handleSettings = () => navigate("/personalsettings");
  const handleNavigate = (path, opts = {}) => {
    navigate(opts.raw ? path : createPageUrl(path));
  };
  // Open the command palette by dispatching Cmd+K; CommandPalette component listens for it globally
  const openPalette = () => {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      ctrlKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);
  };

  /* ---------- Mobile layout ---------- */
  if (isMobile) {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#0b0b0d] overflow-hidden">
        <MobileTopBar onMenuClick={() => setMobileMenuOpen(true)} />

        {/* Backdrop */}
        <div
          className={`fixed inset-0 bg-black/70 z-40 transition-opacity duration-200 ${
            mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Drawer */}
        <aside
          className={`fixed top-0 left-0 h-full w-[85vw] max-w-xs z-50 transform transition-transform duration-200 ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarBody
            user={userProfile}
            collapsed={false}
            hideCollapseToggle={true}
            onToggleCollapse={() => setMobileMenuOpen(false)}
            onLogout={handleLogout}
            onSettings={handleSettings}
            onChatToggle={() => {
              setChatOpen(true);
              setMobileMenuOpen(false);
            }}
            chatOpen={chatOpen}
            onOpenPalette={openPalette}
            currentPath={location.pathname}
            onNavigate={(p, opts) => {
              handleNavigate(p, opts);
              setMobileMenuOpen(false);
            }}
            projectItems={projectItems}
          />
        </aside>

        <main className="flex-1 overflow-auto min-w-0 bg-white dark:bg-gray-950">{children}</main>

        {chatOpen && (
          <div className="fixed inset-0 z-40 flex flex-col bg-white">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 bg-white shrink-0">
              <span className="font-semibold text-gray-900">Agent Chat</span>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="flex items-center justify-center size-9 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                aria-label="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AgentChatPanel
                isOpen={true}
                onClose={() => setChatOpen(false)}
                accounts={accounts}
                fullWidth
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---------- Desktop layout ---------- */
  const sidebarWidth = collapsed ? 56 : 240;
  return (
    <div className="flex h-screen bg-[#0b0b0d] overflow-hidden">
      <aside
        style={{ width: sidebarWidth }}
        className="shrink-0 transition-[width] duration-150 ease-out"
      >
        <SidebarBody
          user={userProfile}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onLogout={handleLogout}
          onSettings={handleSettings}
          onChatToggle={() => setChatOpen((o) => !o)}
          chatOpen={chatOpen}
          onOpenPalette={openPalette}
          currentPath={location.pathname}
          onNavigate={handleNavigate}
          projectItems={projectItems}
        />
      </aside>
      <main className="flex-1 overflow-auto min-w-0 bg-white dark:bg-gray-950">{children}</main>
      <AgentChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        accounts={accounts}
      />
    </div>
  );
}

export default LinearSidebar;
