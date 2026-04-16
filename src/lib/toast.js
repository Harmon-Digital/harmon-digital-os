import { toast as sonnerToast } from "sonner";

// Linear-style toast helper.
// Usage:
//   toast.success("Saved")
//   toast.error("Failed to save", { description: err.message })
//   toast.info("Logged 3h to Hoplite")
//   toast.loading("Uploading…") → returns id, call toast.dismiss(id) or toast.success("Done", { id })
//
// All toasts auto-dismiss after 3s (error = 5s) unless duration is overridden.

const DEFAULT = { duration: 3000 };
const LONGER = { duration: 5000 };

export const toast = {
  success: (message, opts = {}) => sonnerToast.success(message, { ...DEFAULT, ...opts }),
  error: (message, opts = {}) => sonnerToast.error(message, { ...LONGER, ...opts }),
  info: (message, opts = {}) => sonnerToast(message, { ...DEFAULT, ...opts }),
  warning: (message, opts = {}) => sonnerToast.warning(message, { ...LONGER, ...opts }),
  loading: (message, opts = {}) => sonnerToast.loading(message, opts),
  dismiss: (id) => sonnerToast.dismiss(id),
  // promise wrapper: toast.promise(fetchX(), { loading: 'Saving…', success: 'Saved', error: 'Failed' })
  promise: (promise, msgs) =>
    sonnerToast.promise(promise, {
      loading: msgs?.loading || "Working…",
      success: msgs?.success || "Done",
      error: (err) => msgs?.error || err?.message || "Something went wrong",
    }),
};

export default toast;
