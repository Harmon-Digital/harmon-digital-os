import React from "react";
import { MessageSquare } from "lucide-react";

export default function ClientMessages() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100 mb-1">Messages</h1>
      <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-6">
        Chat with your Harmon Digital team.
      </p>
      <div className="py-16 text-center border border-dashed border-gray-200 dark:border-gray-800 rounded-md">
        <MessageSquare className="w-7 h-7 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-[13px] text-gray-500 dark:text-gray-400">Messaging is coming soon.</p>
        <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1">
          For now, reach out to your account manager directly.
        </p>
      </div>
    </div>
  );
}
