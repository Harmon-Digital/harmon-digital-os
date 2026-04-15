import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const STATUS_LIST = [
  { id: "draft", label: "Draft" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
];

const STATUS_COLOR = {
  draft: "#9ca3af", // gray-400
  scheduled: "#3b82f6", // blue-500
  published: "#22c55e", // green-500
};

export function PostStatusIcon({ status = "draft", size = 14, className = "" }) {
  const color = STATUS_COLOR[status] || STATUS_COLOR.draft;
  const s = size;
  const r = s / 2 - 1;
  const cx = s / 2;
  const cy = s / 2;

  if (status === "published") {
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
  if (status === "scheduled") {
    // clock face: hollow circle + two clock hands
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className={className}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={1.5} />
        <line
          x1={cx}
          y1={cy}
          x2={cx}
          y2={cy - r * 0.55}
          stroke={color}
          strokeWidth={1.3}
          strokeLinecap="round"
        />
        <line
          x1={cx}
          y1={cy}
          x2={cx + r * 0.5}
          y2={cy}
          stroke={color}
          strokeWidth={1.3}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  // draft: dashed hollow circle
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
    </svg>
  );
}

export function PostStatusPicker({ value, onChange, children }) {
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
            <PostStatusIcon status={s.id} size={14} />
            <span>{s.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export const PLATFORM_LABELS = {
  linkedin: "LinkedIn",
  twitter: "Twitter",
  facebook: "Facebook",
  instagram: "Instagram",
};

export const PLATFORM_LETTERS = {
  linkedin: "in",
  twitter: "X",
  facebook: "f",
  instagram: "ig",
};

const PLATFORM_BG = {
  linkedin: "bg-blue-100 text-blue-700",
  twitter: "bg-gray-900 text-white",
  facebook: "bg-blue-100 text-blue-800",
  instagram: "bg-pink-100 text-pink-700",
};

export function PlatformChip({ platform, size = "sm" }) {
  const letter = PLATFORM_LETTERS[platform] || "·";
  const bg = PLATFORM_BG[platform] || "bg-gray-100 text-gray-700";
  const dims = size === "sm" ? "w-5 h-5 text-[9px]" : "w-6 h-6 text-[10px]";
  return (
    <span
      title={PLATFORM_LABELS[platform] || platform}
      className={`inline-flex items-center justify-center rounded font-semibold ${dims} ${bg}`}
    >
      {letter}
    </span>
  );
}
