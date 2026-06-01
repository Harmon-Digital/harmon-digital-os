-- Prevent privilege escalation via user_profiles.role.
--
-- Background: existing RLS on public.user_profiles lets any authenticated
-- user INSERT or UPDATE their own row (id = auth.uid()), with no WITH CHECK
-- constraint on the role column. That means a regular user could grant
-- themselves role='admin' (or 'partner', etc.) with a single client-side call:
--   await supabase.from('user_profiles').update({ role: 'admin' }).eq('id', user.id);
--
-- The PartnerLogin self-signup flow exposed this for the 'partner' role,
-- but the underlying issue applies to every role. Closing the hole at the
-- DB layer is the right level — RLS alone can't easily express "this column
-- may only be written by service role or by an admin user" without breaking
-- legitimate self-updates of other columns.
--
-- This migration installs a BEFORE INSERT/UPDATE trigger that:
--   * On INSERT: forces role to a safe default ('user') unless the caller
--     is service_role or an admin. Self-signup may still create a row for
--     itself, but cannot pick its own role.
--   * On UPDATE: silently keeps the OLD role unless the caller is
--     service_role or an existing admin. Other columns update normally.
--
-- Service-role bypasses RLS entirely; the trigger lets it through via
-- current_setting('role'). Admins are identified via the existing is_admin().

CREATE OR REPLACE FUNCTION public.guard_user_profiles_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text := current_setting('role', true);
  is_service  boolean := caller_role = 'service_role';
  caller_is_admin boolean := FALSE;
BEGIN
  -- A SECURITY DEFINER call from service_role still reports the original
  -- role via current_setting, so trust it as an authoritative bypass.
  IF is_service THEN
    RETURN NEW;
  END IF;

  -- For authenticated callers, check whether they are already admin in the
  -- table (NOT relying on the row they are trying to modify).
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO caller_is_admin;

  IF caller_is_admin THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Force a safe default role on self-signup. Clients can no longer pick
    -- their own role; promotion happens via an admin or an edge function
    -- using the service-role key. 'member' matches the existing non-privileged
    -- role already used elsewhere in the codebase.
    NEW.role := 'member';
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Keep the prior role; allow every other column to be patched freely.
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_profiles_role ON public.user_profiles;
CREATE TRIGGER trg_guard_user_profiles_role
BEFORE INSERT OR UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_user_profiles_role();
