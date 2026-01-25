import React from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Info, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function NotificationItem({ notification, onMarkAsRead, onClose }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
      onClose();
    }
  };

  const typeConfig = {
    success: {
      icon: <CheckCircle className="w-5 h-5 text-green-500" />,
      bg: "bg-green-50",
      border: "border-l-green-500"
    },
    info: {
      icon: <Info className="w-5 h-5 text-blue-500" />,
      bg: "bg-blue-50",
      border: "border-l-blue-500"
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-orange-500" />,
      bg: "bg-orange-50",
      border: "border-l-orange-500"
    },
    error: {
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      bg: "bg-red-50",
      border: "border-l-red-500"
    }
  };

  const config = typeConfig[notification.type] || typeConfig.info;
  const timeAgo = getTimeAgo(new Date(notification.created_date));

  return (
    <div
      className={`p-4 border-l-4 ${config.border} ${
        notification.read ? 'bg-white' : config.bg
      } hover:bg-gray-50 transition-colors cursor-pointer`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-semibold text-sm text-gray-900">
              {notification.title}
            </h4>
            {!notification.read && (
              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-2">
            {notification.message}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{timeAgo}</span>
            {!notification.read && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead(notification.id);
                }}
              >
                Mark as read
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval !== 1 ? 's' : ''} ago`;
    }
  }

  return 'Just now';
}