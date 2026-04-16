import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/api/supabaseClient";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  CheckSquare,
  MessageSquare,
  Folder,
  Settings,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { path: "/client", icon: LayoutDashboard, label: "Overview", exact: true },
  { path: "/client/projects", icon: FolderKanban, label: "Projects" },
  { path: "/client/approvals", icon: CheckSquare, label: "Approvals" },
  { path: "/client/invoices", icon: FileText, label: "Invoices" },
  { path: "/client/messages", icon: MessageSquare, label: "Messages" },
  { path: "/client/documents", icon: Folder, label: "Documents" },
  { path: "/client/settings", icon: Settings, label: "Settings" },
];

export default function ClientLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userProfile, signOut } = useAuth();
  const [account, setAccount] = useState(null);

  // Pull the client's linked account (via contacts.portal_user_id) so we
  // can show their logo + company name in the header.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: contact } = await supabase
          .from("contacts")
          .select("account_id")
          .eq("portal_user_id", user.id)
          .maybeSingle();
        if (cancelled || !contact?.account_id) return;
        const { data: acc } = await supabase
          .from("accounts")
          .select("id, company_name, logo_url")
          .eq("id", contact.account_id)
          .maybeSingle();
        if (!cancelled) setAccount(acc || null);
      } catch (err) {
        console.error("ClientLayout account load failed:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleLogout = async () => {
    await signOut();
    navigate("/client/login");
  };

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname === item.path || location.pathname.startsWith(item.path + "/");
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-900/50">
        {/* Client brand header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            {account?.logo_url ? (
              <img
                src={account.logo_url}
                alt={account.company_name}
                className="w-8 h-8 rounded object-contain bg-white border border-gray-200 dark:border-gray-700 flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 flex items-center justify-center text-[12px] font-semibold flex-shrink-0">
                {(account?.company_name || userProfile?.full_name || "C").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                {account?.company_name || "Client Portal"}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">Powered by Harmon Digital</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2">
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
                    active
                      ? "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User */}
        <div className="p-2 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5 px-2.5 py-1.5">
            <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center text-[11px] font-medium flex-shrink-0">
              {(userProfile?.full_name || "U").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-gray-900 dark:text-gray-100 truncate">
                {userProfile?.full_name || "Client"}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {userProfile?.email}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-1 flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-[12px] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-white dark:bg-gray-950">
        {children}
      </main>
    </div>
  );
}
