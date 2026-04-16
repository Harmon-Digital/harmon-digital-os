import React, { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

/**
 * Linear-style inline-editable text.
 * - Renders as plain text by default.
 * - Hover reveals a small pencil button.
 * - Click pencil (or hit `e` while hovered/focused) → input appears.
 * - Enter saves (calls onSave), Esc cancels, blur saves.
 *
 * Props:
 *   value         current text
 *   onSave(next)  called when committed (only if value changed and not empty)
 *   className     applied to the rendered text span
 *   inputClass    applied to the input
 *   placeholder
 *   disabled      hide the pencil entirely
 *   stopPropagation  if true, click events on the editor stay inside
 */
export default function InlineEdit({
  value = "",
  onSave,
  className = "",
  inputClass = "",
  placeholder = "Untitled",
  disabled = false,
  stopPropagation = true,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = (draft || "").trim();
    if (trimmed && trimmed !== value) {
      onSave?.(trimmed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => stopPropagation && e.stopPropagation()}
        onMouseDown={(e) => stopPropagation && e.stopPropagation()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        placeholder={placeholder}
        className={`bg-white dark:bg-gray-950 border border-indigo-300 rounded px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-indigo-200 text-[13px] text-gray-900 dark:text-gray-100 ${inputClass}`}
      />
    );
  }

  return (
    <span className={`group/edit inline-flex items-center gap-1 min-w-0 ${className}`}>
      <span className="truncate">{value || <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>}</span>
      {!disabled && (
        <button
          type="button"
          onClick={(e) => {
            if (stopPropagation) e.stopPropagation();
            setEditing(true);
          }}
          className="opacity-0 group-hover/edit:opacity-100 p-0.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 transition-opacity flex-shrink-0"
          title="Edit (or double-click)"
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
