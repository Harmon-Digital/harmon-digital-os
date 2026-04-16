import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { parseLocalDate } from "@/utils";
import { FileText, ExternalLink } from "lucide-react";

const STATUS_COLOR = {
  paid: "text-green-600",
  sent: "text-blue-600",
  overdue: "text-red-600",
  draft: "text-gray-500",
};

export default function ClientInvoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data: contact } = await supabase
          .from("contacts")
          .select("account_id")
          .eq("portal_user_id", user.id)
          .maybeSingle();
        if (!contact?.account_id) { setLoading(false); return; }
        const { data } = await supabase
          .from("invoices")
          .select("id, invoice_number, due_date, total, status, stripe_invoice_url, pdf_url")
          .eq("account_id", contact.account_id)
          .order("due_date", { ascending: false });
        setInvoices(data || []);
      } catch (err) {
        console.error("Invoices load failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const openCount = invoices.filter((i) => i.status === "sent" || i.status === "overdue").length;
  const openTotal = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + (Number(i.total) || 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100 mb-1">Invoices</h1>
      <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-6">
        View and pay your invoices.
      </p>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-gray-600 dark:text-gray-400 mb-4">
        <span>Open <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{openCount}</span></span>
        <span>Amount due <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">${openTotal.toLocaleString()}</span></span>
        <span>Total invoices <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{invoices.length}</span></span>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800">
        {loading ? (
          <div className="py-10 text-center text-[13px] text-gray-400">Loading…</div>
        ) : invoices.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-gray-500 dark:text-gray-400">
            No invoices yet.
          </div>
        ) : (
          invoices.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 px-2 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60">
              <FileText className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="flex-1 text-[13px] text-gray-900 dark:text-gray-100 truncate">
                {inv.invoice_number || `INV-${inv.id.slice(0, 8)}`}
              </span>
              <span className="text-[12px] text-gray-500 dark:text-gray-400 w-24 text-right">
                {inv.due_date ? parseLocalDate(inv.due_date).toLocaleDateString() : "—"}
              </span>
              <span className="text-[13px] text-gray-900 dark:text-gray-100 font-medium w-24 text-right tabular-nums">
                ${Number(inv.total || 0).toLocaleString()}
              </span>
              <span className={`text-[11px] capitalize w-16 text-right ${STATUS_COLOR[inv.status] || "text-gray-500"}`}>
                {inv.status}
              </span>
              {(inv.status === "sent" || inv.status === "overdue") && inv.stripe_invoice_url ? (
                <a
                  href={inv.stripe_invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 h-7 rounded-md bg-gray-900 hover:bg-gray-800 text-white text-[12px] font-medium"
                >
                  Pay
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : inv.pdf_url ? (
                <a
                  href={inv.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  View
                </a>
              ) : (
                <span className="w-12" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
