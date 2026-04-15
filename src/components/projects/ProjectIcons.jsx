import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const PROJECT_STATUS_LIST = [
  { id: "active", label: "Active" },
  { id: "on_hold", label: "On Hold" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const STATUS_COLOR = {
  active: "#eab308", // yellow-500 (in-progress vibe)
  on_hold: "#f59e0b", // amber-500
  completed: "#22c55e", // green-500
  cancelled: "#6b7280", // gray-500
};

export function ProjectStatusIcon({ status = "active", size = 14, className = "" }) {
  const color = STATUS_COLOR[status] || STATUS_COLOR.active;
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
  if (status === "active") {
    // 3/4-filled pie like Tasks in_progress
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
  if (status === "on_hold") {
    // amber ring with two vertical bars (pause)
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className={className}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={1.5} />
        <rect x={s * 0.32} y={s * 0.3} width={s * 0.1} height={s * 0.4} rx={0.5} fill={color} />
        <rect x={s * 0.58} y={s * 0.3} width={s * 0.1} height={s * 0.4} rx={0.5} fill={color} />
      </svg>
    );
  }
  // cancelled: gray circle with X
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className={className}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={1.5} />
      <line
        x1={s * 0.32}
        y1={s * 0.32}
        x2={s * 0.68}
        y2={s * 0.68}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <line
        x1={s * 0.68}
        y1={s * 0.32}
        x2={s * 0.32}
        y2={s * 0.68}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ProjectStatusPicker({ value, onChange, children }) {
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
        {PROJECT_STATUS_LIST.map((s) => (
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
            <ProjectStatusIcon status={s.id} size={14} />
            <span>{s.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export const RISK_COLOR = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#ef4444",
};

export function RiskDot({ risk }) {
  if (!risk) return null;
  const color = RISK_COLOR[risk] || "#9ca3af";
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: color }}
      title={`${risk} risk`}
    />
  );
}
