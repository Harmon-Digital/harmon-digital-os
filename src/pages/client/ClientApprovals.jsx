import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { Check } from "lucide-react";
import { toast } from "@/lib/toast";

export default function ClientApprovals() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: contact } = await supabase
        .from("contacts")
        .select("account_id")
        .eq("portal_user_id", user.id)
        .maybeSingle();
      if (!contact?.account_id) { setLoading(false); return; }

      const { data } = await supabase
        .from("social_posts")
        .select("id, title, content, image_url, scheduled_date, platforms, approved, status")
        .eq("client_id", contact.account_id)
        .eq("approved", false)
        .in("status", ["draft", "scheduled"])
        .order("scheduled_date", { ascending: true });
      setPosts(data || []);
    } catch (err) {
      console.error("Approvals load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const approve = async (postId) => {
    try {
      const { error } = await supabase.from("social_posts").update({ approved: true }).eq("id", postId);
      if (error) throw error;
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Approved");
    } catch (err) {
      toast.error("Couldn't approve", { description: err.message });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100 mb-1">Approvals</h1>
      <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-6">
        Review and approve content before it goes live.
      </p>

      {loading ? (
        <div className="py-10 text-center text-[13px] text-gray-400">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center">
          <Check className="w-8 h-8 mx-auto text-green-500 mb-2" />
          <p className="text-[14px] text-gray-700 dark:text-gray-300">All caught up</p>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">Nothing waiting for your approval right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} className="border border-gray-200 dark:border-gray-800 rounded-md p-4 bg-white dark:bg-gray-900">
              <div className="flex items-start gap-3 mb-3">
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt=""
                    className="w-16 h-16 rounded object-cover flex-shrink-0"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">{post.title}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    {post.scheduled_date && (
                      <span>Scheduled {new Date(post.scheduled_date).toLocaleDateString()}</span>
                    )}
                    {post.platforms?.length > 0 && (
                      <span>{post.platforms.join(", ")}</span>
                    )}
                  </div>
                </div>
              </div>
              {post.content && (
                <p className="text-[13px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-3">
                  {post.content}
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => approve(post.id)}
                  className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-green-600 hover:bg-green-700 text-white text-[13px] font-medium"
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 text-[13px] hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => toast.info("Feedback coming soon — for now email your account manager.")}
                >
                  Request changes
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
