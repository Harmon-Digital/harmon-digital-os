import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/* ---------------- Status ---------------- */

export const STATUS_LIST = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "completed", label: "Completed" },
];

const STATUS_COLOR = {
  todo: "#9ca3af", // gray-400
  in_progress: "#eab308", // yellow-500
  review: "#3b82f6", // blue-500
  completed: "#22c55e", // green-500
};

export function StatusIcon({ status = "todo", size = 14, className = "" }) {
  const color = STATUS_COLOR[status] || STATUS_COLOR.todo;
  const s = size;
  const r = s / 2 - 1;
  const cx = s / 2;
  const cy = s / 2;
  if (status === "completed") {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className={className}>
        <circle cx={cx} cy={cy} r={r} fill={color} />
        <path
          d={`M${s * 0.28} ${s * 0.52} L${s * 0.44} ${s * 0.68} L${s * 0.74} ${s * 0.36}`}
          fill="none"
          stroke="white"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (status === "in_progress") {
    // 3/4-filled pie
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className={className}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={1.5} />
        <path
          d={`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - r * 0.0001} ${cy + r} Z`}
          fill={color}
        />
      </svg>
    );
  }
  if (status === "review") {
    // dashed ring + center dot
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className={className}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="2 2"
        />
        <circle cx={cx} cy={cy} r={r * 0.35} fill={color} />
      </svg>
    );
  }
  // todo: hollow circle
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className={className}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

export function StatusPicker({ value, onChange, children }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center p-0.5 rounded hover:bg-gray-100"
          onClick={(e) => e.stopPropagation()}
          title="Change status"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1">
        {STATUS_LIST.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(s.id);
            }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-gray-100 ${
              value === s.id ? "bg-gray-100 font-medium" : ""
            }`}
          >
            <StatusIcon status={s.id} size={14} />
            <span>{s.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/* ---------------- Priority ---------------- */

export const PRIORITY_LIST = [
  { id: "urgent", label: "Urgent" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

export function PriorityIcon({ priority = "medium", size = 14, className = "" }) {
  const s = size;
  // urgent: filled square with "!" look
  if (priority === "urgent") {
    return (
      <svg width={s} height={s} viewBox="0 0 14 14" className={className}>
        <rect x={1} y={1} width={12} height={12} rx={3} fill="#ef4444" />
        <rect x={6.25} y={3} width={1.5} height={5} fill="white" />
        <rect x={6.25} y={9.25} width={1.5} height={1.75} fill="white" />
      </svg>
    );
  }
  // bars style for low/medium/high
  const filled = priority === "high" ? 3 : priority === "medium" ? 2 : priority === "low" ? 1 : 0;
  const activeColor = "#4f46e5"; // indigo-600
  const inactiveColor = "#d1d5db"; // gray-300
  const bars = [
    { x: 1, y: 8, w: 2.5, h: 5 }, // low
    { x: 5.25, y: 5, w: 2.5, h: 8 }, // medium
    { x: 9.5, y: 2, w: 2.5, h: 11 }, // high
  ];
  return (
    <svg width={s} height={s} viewBox="0 0 14 14" className={className}>
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx={0.5}
          fill={i < filled ? activeColor : inactiveColor}
        />
      ))}
    </svg>
  );
}

export function PriorityPicker({ value, onChange, children }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center p-0.5 rounded hover:bg-gray-100"
          onClick={(e) => e.stopPropagation()}
          title="Change priority"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-36 p-1">
        {PRIORITY_LIST.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(p.id);
            }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-gray-100 ${
              value === p.id ? "bg-gray-100 font-medium" : ""
            }`}
          >
            <PriorityIcon priority={p.id} size={14} />
            <span>{p.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
