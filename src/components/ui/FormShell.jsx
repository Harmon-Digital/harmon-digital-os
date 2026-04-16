import React, { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * FormShell — renders a form modal as either a right-side Sheet (drawer)
 * or a centered Dialog (modal), with a built-in toggle button and
 * localStorage persistence of the user's preference.
 *
 * Usage:
 *   <FormShell
 *     open={showDrawer}
 *     onOpenChange={setShowDrawer}
 *     storageKey="hdo.projectForm.viewMode"   // persists per form type
 *     title="Edit Project"
 *     description="Update project details"
 *     sheetClassName="w-full sm:max-w-xl"     // optional
 *     dialogClassName="sm:max-w-2xl"          // optional
 *   >
 *     <MyForm />
 *   </FormShell>
 */
export default function FormShell({
  open,
  onOpenChange,
  storageKey,
  title,
  description,
  children,
  sheetClassName = "w-full sm:max-w-xl overflow-y-auto",
  dialogClassName = "sm:max-w-2xl max-h-[85vh] overflow-y-auto",
  defaultMode = "sidebar",
}) {
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return defaultMode;
    return (storageKey && window.localStorage.getItem(storageKey)) || defaultMode;
  });

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, viewMode);
  }, [viewMode, storageKey]);

  const ToggleButton = ({ to, Icon, label }) => (
    <button
      type="button"
      onClick={() => setViewMode(to)}
      className="absolute right-12 top-4 p-1 rounded-sm opacity-70 hover:opacity-100 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
      title={label}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  if (viewMode === "center") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={dialogClassName}>
          <ToggleButton to="sidebar" Icon={Minimize2} label="Open as drawer" />
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="mt-4">{children}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={sheetClassName}>
        <ToggleButton to="center" Icon={Maximize2} label="Open as modal" />
        <SheetHeader>
          {title && <SheetTitle>{title}</SheetTitle>}
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="mt-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
