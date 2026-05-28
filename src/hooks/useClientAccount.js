import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/api/supabaseClient";

const PREVIEW_KEY = "hdo.portalPreviewAccount";
const PREVIEW_NAME_KEY = "hdo.portalPreviewAccountName";

/**
 * Resolves the account_id whose data the client portal should render.
 *
 * - Normal client: looks up the account linked to their contact row
 *   (contacts.portal_user_id === auth user id).
 * - Admin/team preview: when an admin opens the portal with
 *   ?preview_account=<id>, that id is captured into sessionStorage and used
 *   instead, so the admin sees exactly what that client would see (the page
 *   queries still apply client_visible + account filters). Persisted in
 *   sessionStorage so it survives navigation between portal pages.
 *
 * Returns { accountId, isPreview, loading }.
 */
export function useClientAccount() {
  const { user, userProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const isStaff = !!userProfile && ["admin", "team"].includes(userProfile.role);
  const paramPreview = searchParams.get("preview_account");

  const [accountId, setAccountId] = useState(null);
  const [isPreview, setIsPreview] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Capture the preview target for staff users and persist it across nav.
    if (isStaff && paramPreview) {
      sessionStorage.setItem(PREVIEW_KEY, paramPreview);
    }
    const previewId = isStaff ? sessionStorage.getItem(PREVIEW_KEY) : null;

    if (previewId) {
      setAccountId(previewId);
      setIsPreview(true);
      setLoading(false);
      return;
    }

    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: contact } = await supabase
          .from("contacts")
          .select("account_id")
          .eq("portal_user_id", user.id)
          .maybeSingle();
        if (!cancelled) {
          setAccountId(contact?.account_id || null);
          setIsPreview(false);
        }
      } catch (err) {
        console.error("useClientAccount lookup failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isStaff, paramPreview]);

  return { accountId, isPreview, loading };
}

/** True if a staff preview session is currently active (sync, no hook). */
export function isPortalPreviewActive() {
  try {
    return !!sessionStorage.getItem(PREVIEW_KEY);
  } catch {
    return false;
  }
}

/** Clear the preview session. */
export function exitPortalPreview() {
  try {
    sessionStorage.removeItem(PREVIEW_KEY);
    sessionStorage.removeItem(PREVIEW_NAME_KEY);
  } catch {
    /* no-op */
  }
}
