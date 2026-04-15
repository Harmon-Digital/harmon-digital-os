import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/ui/RichTextEditor";
import TaskAttachments from "./TaskAttachments";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  StatusIcon,
  StatusPicker,
  PriorityIcon,
  PriorityPicker,
  STATUS_LIST,
  PRIORITY_LIST,
} from "./TaskIcons";
import {
  CheckSquare,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  FolderKanban,
  User as UserIcon,
  Clock,
  Repeat,
  ChevronDown,
} from "lucide-react";

function initialsOf(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function PropertyRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-3 min-h-[32px]">
      <div className="flex items-center gap-1.5 w-28 shrink-0 text-[12px] text-gray-500">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function PropertyButton({ children, active = false }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-left border border-transparent transition-colors ${
        active ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------------- Pickers ---------------- */

function ProjectPicker({ value, projects, onChange }) {
  const selected = projects.find((p) => p.id === value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-gray-700 hover:bg-gray-100 max-w-full"
        >
          <FolderKanban className="w-3.5 h-3.5 text-gray-400" />
          <span className="truncate">{selected ? selected.name : "No project"}</span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1 max-h-80 overflow-y-auto">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${
            !value ? "bg-gray-100 font-medium" : ""
          }`}
        >
          No project
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 truncate ${
              value === p.id ? "bg-gray-100 font-medium" : ""
            }`}
          >
            {p.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function AssigneePicker({ value, teamMembers, onChange }) {
  const selected = teamMembers.find((tm) => tm.id === value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-gray-700 hover:bg-gray-100 max-w-full"
        >
          {selected ? (
            <>
              <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold flex items-center justify-center shrink-0">
                {initialsOf(selected.full_name)}
              </div>
              <span className="truncate">{selected.full_name}</span>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-400">
                ?
              </div>
              <span className="text-gray-500">Unassigned</span>
            </>
          )}
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1 max-h-64 overflow-y-auto">
        <button
          type="button"
          onClick={() => onChange("")}
          className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${
            !value ? "bg-gray-100 font-medium" : ""
          }`}
        >
          Unassigned
        </button>
        {teamMembers
          .filter((tm) => tm.status === "active")
          .map((tm) => (
            <button
              key={tm.id}
              type="button"
              onClick={() => onChange(tm.id)}
              className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 flex items-center gap-2 ${
                value === tm.id ? "bg-gray-100 font-medium" : ""
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold flex items-center justify-center shrink-0">
                {initialsOf(tm.full_name)}
              </div>
              <span className="truncate">{tm.full_name}</span>
            </button>
          ))}
      </PopoverContent>
    </Popover>
  );
}

/* ---------------- Main form ---------------- */

export default function TaskForm({ task, projects = [], teamMembers = [], onSubmit, onCancel }) {
  const [pendingFiles, setPendingFiles] = useState([]);
  const [formData, setFormData] = useState(
    task || {
      title: "",
      description: "",
      project_id: "",
      assigned_to: "",
      status: "todo",
      priority: "medium",
      estimated_hours: 0,
      due_date: "",
      recurrence_enabled: false,
      recurrence_mode: "on_complete",
      recurrence_frequency: "weekly",
      recurrence_interval: 1,
      recurrence_end_date: "",
      recurrence_count: "",
      checklist: [],
    },
  );
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);

  const checklist = Array.isArray(formData.checklist) ? formData.checklist : [];
  const setChecklist = (items) => setFormData({ ...formData, checklist: items });

  const addChecklistItem = (text) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    setChecklist([
      ...checklist,
      {
        id: (crypto?.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`,
        text: trimmed,
        done: false,
      },
    ]);
    setNewChecklistItem("");
  };
  const toggleChecklistItem = (id) =>
    setChecklist(checklist.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  const removeChecklistItem = (id) =>
    setChecklist(checklist.filter((it) => it.id !== id));
  const updateChecklistItemText = (id, text) =>
    setChecklist(checklist.map((it) => (it.id === id ? { ...it, text } : it)));

  const statusLabel = STATUS_LIST.find((s) => s.id === formData.status)?.label || "Status";
  const priorityLabel = PRIORITY_LIST.find((p) => p.id === formData.priority)?.label || "Priority";

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanedData = {
      ...formData,
      project_id: formData.project_id || null,
      assigned_to: formData.assigned_to || null,
      due_date: formData.due_date || null,
      recurrence_enabled: !!formData.recurrence_enabled,
      recurrence_mode: formData.recurrence_enabled
        ? formData.recurrence_mode || "on_complete"
        : "on_complete",
      recurrence_frequency: formData.recurrence_enabled ? formData.recurrence_frequency : null,
      recurrence_interval: formData.recurrence_enabled
        ? Math.max(1, parseInt(formData.recurrence_interval || 1, 10))
        : 1,
      recurrence_end_date:
        formData.recurrence_enabled && formData.recurrence_end_date
          ? formData.recurrence_end_date
          : null,
      recurrence_count:
        formData.recurrence_enabled && formData.recurrence_count
          ? Math.max(1, parseInt(formData.recurrence_count, 10))
          : null,
    };
    onSubmit(cleanedData, pendingFiles);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title — big, borderless, Linear-style */}
      <Textarea
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        placeholder="Task title"
        rows={1}
        required
        className="border-0 shadow-none focus-visible:ring-0 px-0 text-lg font-semibold leading-tight min-h-[32px] resize-none placeholder:text-gray-300"
      />

      {/* Property rows */}
      <div className="space-y-1">
        <PropertyRow icon={({ className }) => <StatusIcon status={formData.status} size={14} className={className} />} label="Status">
          <StatusPicker
            value={formData.status}
            onChange={(v) => setFormData({ ...formData, status: v })}
          >
            <PropertyButton>
              <StatusIcon status={formData.status} size={14} />
              <span>{statusLabel}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </PropertyButton>
          </StatusPicker>
        </PropertyRow>

        <PropertyRow icon={({ className }) => <PriorityIcon priority={formData.priority} size={14} className={className} />} label="Priority">
          <PriorityPicker
            value={formData.priority}
            onChange={(v) => setFormData({ ...formData, priority: v })}
          >
            <PropertyButton>
              <PriorityIcon priority={formData.priority} size={14} />
              <span>{priorityLabel}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </PropertyButton>
          </PriorityPicker>
        </PropertyRow>

        <PropertyRow icon={UserIcon} label="Assignee">
          <AssigneePicker
            value={formData.assigned_to || ""}
            teamMembers={teamMembers}
            onChange={(v) => setFormData({ ...formData, assigned_to: v })}
          />
        </PropertyRow>

        <PropertyRow icon={FolderKanban} label="Project">
          <ProjectPicker
            value={formData.project_id}
            projects={projects}
            onChange={(v) => setFormData({ ...formData, project_id: v })}
          />
        </PropertyRow>

        <PropertyRow icon={CalendarIcon} label="Due date">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-100">
            <input
              type="date"
              value={formData.due_date || ""}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="bg-transparent text-[13px] text-gray-700 outline-none"
            />
            {formData.due_date && (
              <button
                type="button"
                onClick={() => setFormData({ ...formData, due_date: "" })}
                className="text-gray-400 hover:text-gray-600"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </PropertyRow>

        <PropertyRow icon={Clock} label="Estimate">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-100">
            <input
              type="number"
              step="0.5"
              min={0}
              value={formData.estimated_hours ?? 0}
              onChange={(e) =>
                setFormData({ ...formData, estimated_hours: parseFloat(e.target.value) || 0 })
              }
              className="bg-transparent text-[13px] text-gray-700 outline-none w-16"
            />
            <span className="text-[12px] text-gray-500">hrs</span>
          </div>
        </PropertyRow>

        <PropertyRow icon={Repeat} label="Repeat">
          <button
            type="button"
            onClick={() => {
              const next = !formData.recurrence_enabled;
              setFormData({ ...formData, recurrence_enabled: next });
              setRecurrenceOpen(next);
            }}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-gray-700 hover:bg-gray-100"
          >
            {formData.recurrence_enabled
              ? `Every ${formData.recurrence_interval || 1} ${formData.recurrence_frequency || "week"}${(formData.recurrence_interval || 1) > 1 ? "s" : ""}`
              : "Doesn't repeat"}
          </button>
        </PropertyRow>

        {formData.recurrence_enabled && (
          <div className="ml-28 pl-3 space-y-2 py-2 border-l border-gray-100">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[11px] text-gray-500 mb-1">Mode</div>
                <select
                  value={formData.recurrence_mode || "on_complete"}
                  onChange={(e) => setFormData({ ...formData, recurrence_mode: e.target.value })}
                  className="w-full text-[13px] px-2 py-1 border border-gray-200 rounded-md"
                >
                  <option value="on_complete">Create next when completed</option>
                  <option value="calendar">Calendar schedule</option>
                </select>
              </div>
              <div>
                <div className="text-[11px] text-gray-500 mb-1">Frequency</div>
                <select
                  value={formData.recurrence_frequency || "weekly"}
                  onChange={(e) =>
                    setFormData({ ...formData, recurrence_frequency: e.target.value })
                  }
                  className="w-full text-[13px] px-2 py-1 border border-gray-200 rounded-md"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <div className="text-[11px] text-gray-500 mb-1">Every</div>
                <Input
                  type="number"
                  min={1}
                  value={formData.recurrence_interval || 1}
                  onChange={(e) =>
                    setFormData({ ...formData, recurrence_interval: e.target.value })
                  }
                  className="h-7 text-[13px]"
                />
              </div>
              <div>
                <div className="text-[11px] text-gray-500 mb-1">Max occurrences</div>
                <Input
                  type="number"
                  min={1}
                  value={formData.recurrence_count || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, recurrence_count: e.target.value })
                  }
                  placeholder="Unlimited"
                  className="h-7 text-[13px]"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Description — block that reveals its toolbar on focus */}
      <div className="task-description-block border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-100 transition-colors overflow-hidden">
        <RichTextEditor
          value={formData.description}
          onChange={(content) => setFormData({ ...formData, description: content })}
          placeholder="Add a description…"
        />
      </div>
      <style>{`
        /* Hide Quill's outer borders so our wrapper is the one border */
        .task-description-block .ql-toolbar,
        .task-description-block .ql-container {
          border: none !important;
        }
        /* Toolbar hidden at rest, revealed when the description block is focused */
        .task-description-block .ql-toolbar {
          max-height: 0;
          padding: 0 12px;
          overflow: hidden;
          opacity: 0;
          border-bottom: 1px solid transparent !important;
          transition: max-height 0.15s ease, padding 0.15s ease, opacity 0.15s ease, border-color 0.15s ease;
        }
        .task-description-block:focus-within .ql-toolbar {
          max-height: 48px;
          padding: 6px 12px;
          opacity: 1;
          border-bottom-color: #f3f4f6 !important;
        }
        .task-description-block .ql-editor {
          min-height: 80px;
          padding: 10px 12px;
        }
        .task-description-block .ql-editor.ql-blank::before {
          left: 12px;
          color: #9ca3af;
          font-style: normal;
        }
      `}</style>

      {/* Checklist */}
      <div>
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-1.5">
          <CheckSquare className="w-3 h-3" />
          <span>Checklist</span>
          {checklist.length > 0 && (
            <span className="normal-case tracking-normal font-normal text-gray-400">
              · {checklist.filter((i) => i.done).length}/{checklist.length}
            </span>
          )}
        </div>
        {checklist.length > 0 && (
          <ul className="space-y-0.5">
            {checklist.map((item) => (
              <li
                key={item.id}
                className="group flex items-center gap-2 px-1 py-0.5 rounded hover:bg-gray-50"
              >
                <Checkbox
                  checked={!!item.done}
                  onCheckedChange={() => toggleChecklistItem(item.id)}
                />
                <Input
                  value={item.text}
                  onChange={(e) => updateChecklistItemText(item.id, e.target.value)}
                  className={`h-7 border-none shadow-none focus-visible:ring-0 px-1 text-sm ${
                    item.done ? "line-through text-gray-400" : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => removeChecklistItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 rounded"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2 pl-1">
          <Plus className="w-3.5 h-3.5 text-gray-400" />
          <Input
            value={newChecklistItem}
            onChange={(e) => setNewChecklistItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addChecklistItem(newChecklistItem);
              }
            }}
            placeholder="Add a subtask"
            className="h-7 border-none shadow-none focus-visible:ring-0 px-1 text-sm"
          />
        </div>
      </div>

      {/* Attachments */}
      <TaskAttachments
        taskId={task?.id || null}
        pendingFiles={pendingFiles}
        onPendingChange={setPendingFiles}
      />

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
          {task ? "Update" : "Create"} Task
        </Button>
      </div>
    </form>
  );
}
