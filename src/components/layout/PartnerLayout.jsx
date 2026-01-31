import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  DollarSign,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { path: "/partner", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/partner/submit", icon: UserPlus, label: "Submit Referral" },
  { path: "/partner/referrals", icon: Users, label: "My Referrals" },
  { path: "/partner/payouts", icon: DollarSign, label: "Payouts" },
  { path: "/partner/settings", icon: Settings, label: "Settings" },
];

export default function PartnerLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/partner/login");
  };

  return (
    <div className="flex h-screen bg-black">
      {/* Sidebar */}
      <aside className="w-64 border-r border-neutral-800 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Harmon Digital" className="w-8 h-8 object-contain" />
            <div>
              <div className="font-medium text-white text-sm">Harmon Digital</div>
              <div className="text-xs text-neutral-500">Partner Portal</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3 px-3">
            Menu
          </div>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? "bg-neutral-800 text-white"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-neutral-800">
          <div className="flex items-center gap-3 mb-4 px-3">
            <div className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {userProfile?.full_name?.charAt(0) || "P"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {userProfile?.full_name || "Partner"}
              </div>
              <div className="text-xs text-neutral-500 truncate">
                {userProfile?.email}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-black">
        {children}
      </main>
    </div>
  );
}
