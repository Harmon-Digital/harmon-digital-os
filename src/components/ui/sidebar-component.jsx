
"use client";

import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import AgentChatPanel from "@/components/chat/AgentChatPanel";
import { supabase } from "@/api/supabaseClient";
import {
  LayoutDashboard,
  FolderKanban,
  Clock,
  FileText,
  Target,
  Calendar,
  BarChart3,
  CheckSquare,
  UsersRound,
  Building2,
  UserCircle,
  Briefcase,
  TrendingUp,
  Receipt,
  Settings,
  ChevronDown,
  LogOut,
  User as UserIcon,
  GripVertical,
  DollarSign,
  Handshake,
  KeyRound,
  MessageSquare,
  MessageSquareDot,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NotificationBell from "../NotificationBell";

const softSpringEasing = "cubic-bezier(0.25, 1.1, 0.4, 1)";

// Local storage key for sidebar width
const SIDEBAR_WIDTH_KEY = "harmon-sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 240;

/* ----------------------------- Brand / Logos ----------------------------- */

function InterfacesLogoSquare() {
  return (
    <div className="w-5 h-5 overflow-clip relative shrink-0">
      <img
        src="/logo.png"
        alt="Harmon Digital OS"
        className="w-full h-full object-contain"
      />
    </div>
  );
}

function BrandBadge() {
  return (
    <div className="relative shrink-0 w-full">
      <div className="flex items-center gap-2 p-3 w-full">
        <InterfacesLogoSquare />
        <div className="font-medium text-sm text-neutral-50">
          Harmon Digital OS
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Avatar -------------------------------- */

function AvatarCircle({ user }) {
  return (
    <div className="relative rounded-full shrink-0 size-8 bg-gradient-to-br from-indigo-600 to-blue-600">
      <div className="flex items-center justify-center size-8">
        <span className="text-white text-sm font-semibold">
          {user?.full_name?.charAt(0) || 'U'}
        </span>
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full border border-neutral-800 pointer-events-none"
      />
    </div>
  );
}

/* --------------------------- Types / Content Map -------------------------- */

function getSidebarContent(activeSection, user) {
  const isAdmin = user?.role === "admin";
  
  const contentMap = {
    operations: {
      title: "Operations",
      sections: [
        {
          title: "Overview",
          items: [
            { icon: <LayoutDashboard className="w-4 h-4 text-neutral-50" />, label: "Dashboard", path: "Dashboard" },
            { icon: <FolderKanban className="w-4 h-4 text-neutral-50" />, label: "Projects", path: "Projects" },
            { icon: <CheckSquare className="w-4 h-4 text-neutral-50" />, label: "Tasks", path: "Tasks" },
            { icon: <Clock className="w-4 h-4 text-neutral-50" />, label: "Time Tracking", path: "TimeTracking" },
            { icon: <FileText className="w-4 h-4 text-neutral-50" />, label: "SOPs", path: "SOPs" },
            { icon: <Building2 className="w-4 h-4 text-neutral-50" />, label: "Branding", path: "Branding" },
          ],
        },
      ],
    },
    sales: {
      title: "Sales",
      sections: [
        {
          title: "Sales & Marketing",
          items: [
            { icon: <Target className="w-4 h-4 text-neutral-50" />, label: "CRM", path: "CRM" },
            { icon: <Briefcase className="w-4 h-4 text-neutral-50" />, label: "Brokers", path: "BrokerOutreach" },
            { icon: <Building2 className="w-4 h-4 text-neutral-50" />, label: "Accounts", path: "Accounts" },
            { icon: <UserCircle className="w-4 h-4 text-neutral-50" />, label: "Contacts", path: "Contacts" },
            { icon: <Calendar className="w-4 h-4 text-neutral-50" />, label: "Social Media", path: "SocialMedia" },
          ],
        },
      ],
    },
    bot: {
      title: "Harmon Bot",
      sections: [
        {
          title: "Assistant",
          items: [
            { icon: <MessageSquare className="w-4 h-4 text-neutral-50" />, label: "Agents", path: "BotChannel" },
          ],
        },
      ],
    },
  };

  if (isAdmin) {
    contentMap.admin = {
      title: "Admin",
      sections: [
        {
          title: "Admin",
          items: [
            { icon: <LayoutDashboard className="w-4 h-4 text-neutral-50" />, label: "Dashboard", path: "AdminDashboard" },
            { icon: <UsersRound className="w-4 h-4 text-neutral-50" />, label: "Team", path: "Team" },
            { icon: <DollarSign className="w-4 h-4 text-neutral-50" />, label: "Accounting", path: "AccountingDashboard" },
            { icon: <BarChart3 className="w-4 h-4 text-neutral-50" />, label: "Reports", path: "Reports" },
            { icon: <TrendingUp className="w-4 h-4 text-neutral-50" />, label: "KPIs", path: "KPIs" },
            { icon: <Handshake className="w-4 h-4 text-neutral-50" />, label: "Partners", path: "Partners" },
            { icon: <Receipt className="w-4 h-4 text-neutral-50" />, label: "Referral Payouts", path: "ReferralPayouts" },
            { icon: <KeyRound className="w-4 h-4 text-neutral-50" />, label: "API Keys", path: "McpApiKeys" },
          ],
        },
      ],
    };
  }

  return contentMap[activeSection] || contentMap.operations;
}

/* ---------------------------- Left Icon Nav Rail -------------------------- */

function IconNavButton({ children, label, isActive = false, onClick }) {
  return (
    <button
      type="button"
      className={`flex flex-col items-center justify-center rounded-lg size-10 min-w-10 transition-colors duration-500
        ${isActive ? "bg-neutral-800 text-neutral-50" : "hover:bg-neutral-800 text-neutral-400 hover:text-neutral-300"}`}
      style={{ transitionTimingFunction: softSpringEasing }}
      onClick={onClick}
      title={label}
    >
      {children}
    </button>
  );
}

function IconNavigation({ activeSection, onSectionChange, user, onLogout, onSettings, chatOpen, onChatToggle }) {
  const isAdmin = user?.role === "admin";
  
  const navItems = [
    { id: "operations", icon: <Briefcase className="w-4 h-4" />, label: "Operations" },
    { id: "sales", icon: <TrendingUp className="w-4 h-4" />, label: "Sales" },
  ];

  if (isAdmin) {
    navItems.push({ id: "admin", icon: <Settings className="w-4 h-4" />, label: "Admin" });
  }

  return (
    <aside className="bg-black flex flex-col gap-2 items-center p-4 w-16 h-screen border-r border-neutral-800">
      {/* Logo */}
      <div className="mb-2 size-10 flex items-center justify-center">
        <div className="size-5">
          <InterfacesLogoSquare />
        </div>
      </div>

      {/* Navigation Icons */}
      <div className="flex flex-col gap-2 w-full items-center">
        {navItems.map((item) => (
          <IconNavButton
            key={item.id}
            label={item.label}
            isActive={activeSection === item.id}
            onClick={() => onSectionChange(item.id)}
          >
            {item.icon}
          </IconNavButton>
        ))}
      </div>

      <div className="flex-1" />

      {/* Bottom section */}
      <div className="flex flex-col gap-2 w-full items-center">
        {/* Chat Panel Toggle — Cmd+\ shortcut */}
        <IconNavButton
          label="Agent Chat (Cmd+\\)"
          isActive={chatOpen}
          onClick={onChatToggle}
        >
          {chatOpen
            ? <MessageSquareDot className="w-4 h-4" />
            : <MessageSquare className="w-4 h-4" />
          }
        </IconNavButton>

        {/* Notification Bell */}
        <NotificationBell />
        
        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="size-8 hover:opacity-80 transition-opacity cursor-pointer">
              <AvatarCircle user={user} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.full_name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSettings} className="cursor-pointer">
              <UserIcon className="w-4 h-4 mr-2" />
              Personal Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-600 focus:text-red-600">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

/* ------------------------------ Right Sidebar ----------------------------- */

function DetailSidebar({ activeSection, user, sidebarWidth, onWidthChange }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const content = getSidebarContent(activeSection, user);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleCollapse = () => setIsCollapsed((s) => !s);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newWidth = e.clientX - 64; // Subtract left icon nav width
        if (newWidth >= 200 && newWidth <= 500) {
          onWidthChange(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onWidthChange]);

  return (
    <aside
      className={`bg-black flex flex-col gap-4 items-start p-4 transition-all h-screen relative ${
        isCollapsed ? "w-16 min-w-16 !px-0 justify-center" : ""
      }`}
      style={{ 
        transitionTimingFunction: softSpringEasing,
        width: isCollapsed ? '64px' : `${sidebarWidth}px`,
        transitionProperty: isDragging ? 'none' : 'all'
      }}
    >
      {!isCollapsed && <BrandBadge />}

      {!isCollapsed && (
        <div className="px-3 pb-2 w-full">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            {content.title}
          </span>
        </div>
      )}

      <div
        className={`flex flex-col w-full overflow-y-auto flex-1 transition-all duration-500 ${
          isCollapsed ? "gap-2 items-center" : "gap-4 items-start"
        }`}
        style={{ transitionTimingFunction: softSpringEasing }}
      >
        {content.sections.map((section, index) => (
          <MenuSection
            key={`${activeSection}-${index}`}
            section={section}
            isCollapsed={isCollapsed}
            navigate={navigate}
            currentPath={location.pathname}
          />
        ))}
      </div>

      {/* Collapse Toggle Button */}
      {!isCollapsed && (
        <div className="w-full pt-2 border-t border-neutral-800">
          <button
            type="button"
            onClick={toggleCollapse}
            className="flex items-center justify-center w-full rounded-lg h-10 transition-all duration-500 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-300"
            style={{ transitionTimingFunction: softSpringEasing }}
            aria-label="Collapse sidebar"
          >
            <ChevronDown className="w-4 h-4 -rotate-90" />
          </button>
        </div>
      )}

      {isCollapsed && (
        <button
          type="button"
          onClick={toggleCollapse}
          className="flex items-center justify-center rounded-lg size-10 min-w-10 transition-all duration-500 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-300"
          style={{ transitionTimingFunction: softSpringEasing }}
          aria-label="Expand sidebar"
        >
          <span className="inline-block rotate-180">
            <ChevronDown className="w-4 h-4" />
          </span>
        </button>
      )}

      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1 hover:w-2 bg-transparent hover:bg-indigo-500 cursor-col-resize transition-all group"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-4 h-4 text-indigo-500" />
          </div>
        </div>
      )}
    </aside>
  );
}

/* ------------------------------ Menu Elements ---------------------------- */

function MenuItem({ item, isCollapsed, navigate, isActive }) {
  const handleClick = () => {
    if (item.path) {
      navigate(createPageUrl(item.path));
    }
  };

  return (
    <div
      className={`relative shrink-0 transition-all duration-500 ${
        isCollapsed ? "w-full flex justify-center" : "w-full"
      }`}
      style={{ transitionTimingFunction: softSpringEasing }}
    >
      <div
        className={`rounded-lg cursor-pointer transition-all duration-500 flex items-center relative ${
          isActive ? "bg-neutral-800" : "hover:bg-neutral-800"
        } ${isCollapsed ? "w-10 min-w-10 h-10 justify-center p-4" : "w-full h-10 px-4 py-2"}`}
        style={{ transitionTimingFunction: softSpringEasing }}
        onClick={handleClick}
        title={isCollapsed ? item.label : undefined}
      >
        <div className="flex items-center justify-center shrink-0">{item.icon}</div>

        <div
          className={`flex-1 relative transition-opacity duration-500 overflow-hidden ${
            isCollapsed ? "opacity-0 w-0" : "opacity-100 ml-3"
          }`}
          style={{ transitionTimingFunction: softSpringEasing }}
        >
          <div className="text-[14px] text-neutral-50 leading-[20px] truncate">
            {item.label}
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuSection({ section, isCollapsed, navigate, currentPath }) {
  return (
    <div className="flex flex-col w-full">
      {section.items.map((item, index) => {
        const itemPath = createPageUrl(item.path);
        const isActive = currentPath === itemPath;
        return (
          <MenuItem
            key={index}
            item={item}
            isCollapsed={isCollapsed}
            navigate={navigate}
            isActive={isActive}
          />
        );
      })}
    </div>
  );
}

/* --------------------------------- Layout -------------------------------- */

export function ModernSidebar({ children }) {
  const [activeSection, setActiveSection] = useState("operations");
  const { user, userProfile, signOut } = useAuth();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const savedWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return savedWidth ? parseInt(savedWidth, 10) : DEFAULT_SIDEBAR_WIDTH;
  });
  const [chatOpen, setChatOpen] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();

  // Load accounts for agent list
  useEffect(() => {
    supabase
      .from("accounts")
      .select("id,company_name")
      .order("company_name", { ascending: true })
      .then(({ data }) => setAccounts(data || []));
  }, []);

  // Keyboard shortcut: Cmd+\ or Ctrl+\ to toggle chat panel
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setChatOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes('team') || path.includes('admindashboard') || path.includes('accountingdashboard') || path.includes('reports') || path.includes('kpis') || path.includes('partners') || path.includes('referralpayouts') || path.includes('mcpapikeys')) {
      setActiveSection('admin');
    } else if (path.includes('botchannel')) {
      setActiveSection('bot');
    } else if (path.includes('crm') || path.includes('brokeroutreach') || path.includes('accounts') || path.includes('contacts') || path.includes('socialmedia')) {
      setActiveSection('sales');
    } else {
      setActiveSection('operations');
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSettings = () => {
    navigate('/PersonalSettings');
  };

  const handleSectionChange = (section) => {
    setActiveSection(section);
  };

  const handleWidthChange = (newWidth) => {
    setSidebarWidth(newWidth);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, newWidth.toString());
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-blue-50 overflow-hidden">
      <IconNavigation
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        user={userProfile}
        onLogout={handleLogout}
        onSettings={handleSettings}
        chatOpen={chatOpen}
        onChatToggle={() => setChatOpen((o) => !o)}
      />
      <DetailSidebar
        activeSection={activeSection}
        user={userProfile}
        sidebarWidth={sidebarWidth}
        onWidthChange={handleWidthChange}
      />
      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>
      <AgentChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        accounts={accounts}
      />
    </div>
  );
}

export default ModernSidebar;
