import React, { useState, useMemo, useCallback, useRef } from "react";

const HOUR_HEIGHT = 48;
const START_HOUR = 6;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;

const COLORS = [
  { bg: "#f3f4f6", border: "#d1d5db", text: "#1f2937" },
  { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
  { bg: "#f5f3ff", border: "#ddd6fe", text: "#6d28d9" },
  { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
  { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46" },
  { bg: "#fff1f2", border: "#fecdd3", text: "#9f1239" },
  { bg: "#ecfeff", border: "#a5f3fc", text: "#155e75" },
  { bg: "#fff7ed", border: "#fed7aa", text: "#9a3412" },
];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseTime(t) {
  if (!t) return null;
  if (typeof t === "string" && t.includes(":")) {
    const [h, m] = t.split(":").map(Number);
    if (!isNaN(h) && !isNaN(m)) return h + m / 60;
  }
  return null;
}

function formatHour(h) {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

export default function WeeklyCalendarView({ timeEntries, projects, users, teamMembers, onEditEntry, onMoveEntry }) {
  const scrollRef = useRef(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // Scroll to 8 AM on mount
  const scrollInit = useCallback((node) => {
    if (node) {
      scrollRef.current = node;
      node.scrollTop = (8 - START_HOUR) * HOUR_HEIGHT;
    }
  }, []);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(currentWeekStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentWeekStart]);

  const navigate = useCallback((dir) => {
    setCurrentWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir * 7);
      return d;
    });
  }, []);

  const goToday = useCallback(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  }, []);

  const projectColorMap = useMemo(() => {
    const map = {};
    projects.forEach((p, i) => { map[p.id] = COLORS[i % COLORS.length]; });
    return map;
  }, [projects]);

  const getProjectName = (pid) => projects.find((p) => p.id === pid)?.name || "—";

  const entriesByDay = useMemo(() => {
    const map = {};
    weekDays.forEach((d) => (map[toDateStr(d)] = []));
    timeEntries.forEach((e) => {
      if (map[e.date]) map[e.date].push(e);
    });
    return map;
  }, [timeEntries, weekDays]);

  const todayStr = toDateStr(new Date());
  const weekEnd = weekDays[6];
  const rangeLabel = `${currentWeekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const weekTotal = timeEntries
    .filter((e) => e.date >= toDateStr(weekDays[0]) && e.date <= toDateStr(weekDays[6]))
    .reduce((s, e) => s + (e.hours || 0), 0);

  // Current time indicator
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const showNowLine = nowHour >= START_HOUR && nowHour <= END_HOUR;

  // Position entry blocks within the hour grid
  function getBlockStyle(entry, dayEntries) {
    let start = parseTime(entry.start_time);
    let end = parseTime(entry.end_time);

    if (start === null) {
      const idx = dayEntries.findIndex((e) => e.id === entry.id);
      start = 8 + idx * (entry.hours || 1);
      end = start + (entry.hours || 1);
    }
    if (end === null) end = start + (entry.hours || 1);

    const top = (Math.max(start, START_HOUR) - START_HOUR) * HOUR_HEIGHT;
    const height = Math.max((end - Math.max(start, START_HOUR)) * HOUR_HEIGHT, 24);
    return { top, height };
  }

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  return (
    <div className="flex flex-col h-full">
      {/* Week nav */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 text-[13px] shrink-0">
        <div className="flex items-center gap-0.5 border border-gray-200 rounded-md p-0.5">
          <button type="button" onClick={() => navigate(-1)} className="px-1.5 py-0.5 text-gray-500 hover:text-gray-900 rounded">‹</button>
          <button type="button" onClick={goToday} className="px-2 py-0.5 text-gray-600 hover:bg-gray-100 rounded text-[12px]">Today</button>
          <button type="button" onClick={() => navigate(1)} className="px-1.5 py-0.5 text-gray-500 hover:text-gray-900 rounded">›</button>
        </div>
        <span className="text-gray-900 font-medium">{rangeLabel}</span>
        <span className="ml-auto text-gray-500">
          Week <span className="text-gray-900 font-medium tabular-nums">{weekTotal.toFixed(1)}h</span>
        </span>
      </div>

      {/* Day headers (fixed) */}
      <div className="flex shrink-0 border-b border-gray-200" style={{ paddingLeft: 52 }}>
        {weekDays.map((day) => {
          const ds = toDateStr(day);
          const isToday = ds === todayStr;
          const dayTotal = (entriesByDay[ds] || []).reduce((s, e) => s + (e.hours || 0), 0);
          return (
            <div key={ds} className="flex-1 py-2 text-center min-w-[100px]">
              <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div className={`text-[15px] font-semibold mt-0.5 ${isToday ? "text-gray-900" : "text-gray-700"}`}>
                {isToday ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-900 text-white text-[14px]">{day.getDate()}</span>
                ) : day.getDate()}
              </div>
              {dayTotal > 0 && <div className="text-[11px] text-gray-500 tabular-nums mt-0.5">{dayTotal.toFixed(1)}h</div>}
            </div>
          );
        })}
      </div>

      {/* Scrollable hour grid */}
      <div ref={scrollInit} className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
        <div className="relative flex" style={{ height: TOTAL_HOURS * HOUR_HEIGHT, minWidth: 752 }}>
          {/* Time labels column */}
          <div className="w-[52px] shrink-0 relative">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-2 text-[11px] text-gray-400 tabular-nums -translate-y-1/2"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Grid area */}
          <div className="flex-1 relative">
            {/* Hour gridlines */}
            {hours.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-gray-100"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
              />
            ))}

            {/* Half-hour gridlines */}
            {hours.map((h) => (
              <div
                key={`half-${h}`}
                className="absolute left-0 right-0 border-t border-gray-50"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
              />
            ))}

            {/* Now line */}
            {showNowLine && (
              <div
                className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                style={{ top: (nowHour - START_HOUR) * HOUR_HEIGHT }}
              >
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                <div className="flex-1 border-t border-red-500" />
              </div>
            )}

            {/* Day columns with entries */}
            <div className="absolute inset-0 flex divide-x divide-gray-100" style={{ left: 0 }}>
              {weekDays.map((day) => {
                const ds = toDateStr(day);
                const entries = entriesByDay[ds] || [];
                const isToday = ds === todayStr;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <div key={ds} className={`flex-1 relative min-w-[100px] ${isWeekend ? "bg-gray-50/30" : ""} ${isToday ? "bg-blue-50/20" : ""}`}>
                    {entries.map((entry) => {
                      const c = projectColorMap[entry.project_id] || COLORS[0];
                      const { top, height } = getBlockStyle(entry, entries);
                      const startFmt = entry.start_time
                        ? (() => { const [h, m] = String(entry.start_time).split(":").map(Number); const d = new Date(); d.setHours(h || 0, m || 0); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); })()
                        : null;

                      return (
                        <div
                          key={entry.id}
                          className="absolute left-0.5 right-0.5 rounded-[3px] px-1.5 py-0.5 cursor-pointer overflow-hidden transition-shadow hover:shadow-md z-10"
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            backgroundColor: c.bg,
                            borderLeft: `3px solid ${c.border}`,
                            color: c.text,
                          }}
                          onClick={() => onEditEntry && onEditEntry(entry)}
                        >
                          <div className="text-[11px] font-medium truncate">{getProjectName(entry.project_id)}</div>
                          <div className="text-[10px] opacity-80">
                            {startFmt && <span>{startFmt} · </span>}
                            <span className="font-medium">{entry.hours}h</span>
                          </div>
                          {height > 40 && entry.description && (
                            <div className="text-[10px] opacity-60 truncate mt-0.5">{entry.description}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
