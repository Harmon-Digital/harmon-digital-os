import React, { useState } from "react";

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

const SIZE_MAP = {
  xs: "w-5 h-5 text-[10px]",
  sm: "w-6 h-6 text-[10px]",
  md: "w-7 h-7 text-xs",
  lg: "w-9 h-9 text-sm",
  xl: "w-11 h-11 text-sm",
};

const DOT_SIZE = {
  xs: "w-1.5 h-1.5 ring-1",
  sm: "w-2 h-2 ring-2",
  md: "w-2.5 h-2.5 ring-2",
  lg: "w-2.5 h-2.5 ring-2",
  xl: "w-3 h-3 ring-2",
};

export default function UserAvatar({
  name,
  imageUrl,
  size = "md",
  online = false,
  ringClass = "ring-white",
  className = "",
}) {
  const [failed, setFailed] = useState(false);
  const showImage = imageUrl && !failed;
  const sizeCls = SIZE_MAP[size] || SIZE_MAP.md;
  const dotCls = DOT_SIZE[size] || DOT_SIZE.md;

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className={`rounded-full overflow-hidden flex items-center justify-center font-semibold ${sizeCls} ${
          showImage ? "bg-gray-100" : "bg-indigo-100 text-indigo-700"
        }`}
      >
        {showImage ? (
          <img
            src={imageUrl}
            alt={name || ""}
            className="w-full h-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <span>{initialsOf(name)}</span>
        )}
      </div>
      {online && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full bg-green-500 ${dotCls} ${ringClass}`}
        />
      )}
    </div>
  );
}
