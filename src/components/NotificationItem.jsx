import React from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare,
  FolderKanban,
  Target,
  Megaphone,
  DollarSign,
  MessageSquare,
  Hash,
  Info,
  AlertTriangle,
  XCircle,
  X,
  Bell,
} from "lucide-react";

const CATEGORY_ICON = {
  tasks: CheckSquare,
  projects: FolderKanban,
  crm: Target,
  social: Megaphone,
  kpi: DollarSign,
  referrals: Target,
  finance: DollarSign,
  chat: MessageSquare,
  channels: Hash,
  system: Bell,
};

// Small colored dot per type — consistent with the email template
function typeDot(type) {
  if (type === "error") return "bg-red-500";
  if (type === "warning") return "bg-amber-500";
  if (type === "success") return "bg-green-500";
  return "bg-gray-400";
}

export default function NotificationItem({ notification, onMarkAsRead, onDelete, onClose }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (!notification.read) onMarkAsRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
      onClose?.();
    }
  };

  const Icon = CATEGORY_ICON[notification.category] || Bell;
  const timeAgo = getTimeAgo(new Date(notification.created_at));
  const unread = !notification.read;

  return (
    <div
      onClick={handleClick}
      className={`group relative flex items-start gap-2.5 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors ${
        unread
          ? "bg-indigo-50/40 hover:bg-indigo-50/60 dark:bg-indigo-900/10 dark:hover:bg-indigo-900/20"
          : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
      }`}
    >
      {/* Unread dot — only visible when unread */}
      <span
        className={`mt-[6px] w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          unread ? typeDot(notification.type) : "bg-transparent"
        }`}
      />

      {/* Category icon */}
      <div className="mt-[2px] flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <Icon className="w-3.5 h-3.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className={`text-[13px] truncate ${
              unread
                ? "font-medium text-gray-900 dark:text-gray-100"
                : "text-gray-700 dark:text-gray-300"
            }`}
          >
            {notification.title}
          </span>
          <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500 tabular-nums flex-shrink-0">
            {timeAgo}
          </span>
        </div>
        {notification.message && (
          <p className="text-[12px] text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
            {notification.message}
          </p>
        )}
      </div>

      {/* Hover-revealed delete */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.(notification.id);
        }}
        className="opacity-0 group-hover:opacity-100 absolute right-2 top-2 p-0.5 rounded text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
        title="Dismiss"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function getTimeAgo(date) {
  const seconds = Math.max(0, Math.floor((new Date() - date) / 1000));
  if (seconds < 30) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(days / 365);
  return `${years}y`;
}
