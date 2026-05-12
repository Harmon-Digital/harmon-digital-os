import React from "react";

/**
 * Harmon Digital lockup — icon + wordmark.
 *
 * Usage:
 *   <Logo />                       // default size (md), icon + text
 *   <Logo size="sm" />             // sidebar-sized
 *   <Logo size="lg" />             // login / hero
 *   <Logo variant="icon" />        // icon only (collapsed sidebar, favicon-ish)
 *   <Logo variant="wordmark" />    // text only
 *   <Logo theme="light" />         // black wordmark on light backgrounds
 *   <Logo className="opacity-80" />
 */

const SIZES = {
  xs: { box: "w-4 h-4", text: "text-[11px]", gap: "gap-1.5" },
  sm: { box: "w-5 h-5", text: "text-sm", gap: "gap-2" },
  md: { box: "w-7 h-7", text: "text-base", gap: "gap-2" },
  lg: { box: "w-10 h-10", text: "text-2xl", gap: "gap-3" },
  xl: { box: "w-16 h-16", text: "text-4xl", gap: "gap-4" },
};

export default function Logo({
  size = "md",
  variant = "full", // "full" | "icon" | "wordmark"
  theme = "auto", // "auto" | "light" | "dark"
  className = "",
  iconClassName = "",
  textClassName = "",
  src = "/logo.png",
}) {
  const s = SIZES[size] || SIZES.md;

  // text colour
  const textColor =
    theme === "light"
      ? "text-neutral-900"
      : theme === "dark"
        ? "text-neutral-100"
        : "text-neutral-900 dark:text-neutral-100";

  if (variant === "icon") {
    return (
      <span
        className={`inline-flex shrink-0 rounded overflow-hidden ${s.box} ${className}`}
        aria-label="Harmon Digital"
      >
        <img src={src} alt="" className={`w-full h-full object-contain ${iconClassName}`} />
      </span>
    );
  }

  if (variant === "wordmark") {
    return (
      <span
        className={`font-semibold tracking-tight ${s.text} ${textColor} ${className} ${textClassName}`}
      >
        Harmon Digital
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`} aria-label="Harmon Digital">
      <span className={`shrink-0 rounded overflow-hidden ${s.box}`}>
        <img src={src} alt="" className={`w-full h-full object-contain ${iconClassName}`} />
      </span>
      <span
        className={`font-semibold tracking-tight ${s.text} ${textColor} ${textClassName}`}
      >
        Harmon Digital
      </span>
    </span>
  );
}
