import React, { useState, useMemo, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const NEUTRAL_COLORS = [
  { bg: "bg-gray-100", border: "border-gray-300", text: "text-gray-800" },
  { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800" },
  { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-800" },
  { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800" },
  { bg: "bg-green-50", border: "border-green-200", text: "text-green-800" },
  { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-800" },
  { bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-800" },
  { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-800" },
];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function WeeklyCalendarView({ timeEntries, projects, users, teamMembers, onEditEntry, onMoveEntry }) {
  const members = teamMembers || users || [];
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

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
    projects.forEach((p, i) => {
      map[p.id] = NEUTRAL_COLORS[i % NEUTRAL_COLORS.length];
    });
    return map;
  }, [projects]);

  const getProjectName = (pid) => projects.find((p) => p.id === pid)?.name || "—";

  const entriesByDay = useMemo(() => {
    const map = {};
    weekDays.forEach((d) => (map[toDateStr(d)] = []));
    timeEntries.forEach((e) => {
      const key = e.date;
      if (map[key]) map[key].push(e);
    });
    return map;
  }, [timeEntries, weekDays]);

  const todayStr = toDateStr(new Date());
  const weekEnd = weekDays[6];
  const rangeLabel = `${currentWeekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const weekTotal = timeEntries
    .filter((e) => {
      const ds = e.date;
      return ds >= toDateStr(weekDays[0]) && ds <= toDateStr(weekDays[6]);
    })
    .reduce((s, e) => s + (e.hours || 0), 0);

  const handleDragEnd = (result) => {
    if (!result.destination || result.source.droppableId === result.destination.droppableId) return;
    const entryId = result.draggableId;
    const newDate = result.destination.droppableId;
    if (onMoveEntry) onMoveEntry(entryId, newDate);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Compact week nav — sits inline inside the already-existing toolbar area */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 text-[13px]">
        <div className="flex items-center gap-0.5 border border-gray-200 rounded-md p-0.5">
          <button type="button" onClick={() => navigate(-1)} className="px-1.5 py-0.5 text-gray-500 hover:text-gray-900 rounded">
            ‹
          </button>
          <button type="button" onClick={goToday} className="px-2 py-0.5 text-gray-600 hover:bg-gray-100 rounded text-[12px]">
            Today
          </button>
          <button type="button" onClick={() => navigate(1)} className="px-1.5 py-0.5 text-gray-500 hover:text-gray-900 rounded">
            ›
          </button>
        </div>
        <span className="text-gray-900 font-medium">{rangeLabel}</span>
        <span className="ml-auto text-gray-500">
          Week total <span className="text-gray-900 font-medium tabular-nums">{weekTotal.toFixed(1)}h</span>
        </span>
      </div>

      {/* Day columns */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto min-h-0">
          <div className="grid grid-cols-7 min-w-[840px] h-full divide-x divide-gray-100">
            {weekDays.map((day) => {
              const ds = toDateStr(day);
              const entries = entriesByDay[ds] || [];
              const dayTotal = entries.reduce((s, e) => s + (e.hours || 0), 0);
              const isToday = ds === todayStr;
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;

              return (
                <Droppable droppableId={ds} key={ds}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-col min-h-0 ${snapshot.isDraggingOver ? "bg-gray-50" : isWeekend ? "bg-gray-50/40" : "bg-white"}`}
                    >
                      {/* Day header */}
                      <div className={`px-2 py-2 text-center border-b ${isToday ? "border-gray-900" : "border-gray-100"}`}>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                          {day.toLocaleDateString("en-US", { weekday: "short" })}
                        </div>
                        <div className={`text-[15px] font-semibold mt-0.5 ${isToday ? "text-gray-900" : "text-gray-700"}`}>
                          {isToday ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-900 text-white text-[14px]">
                              {day.getDate()}
                            </span>
                          ) : (
                            day.getDate()
                          )}
                        </div>
                        {dayTotal > 0 && (
                          <div className="text-[11px] text-gray-500 tabular-nums mt-0.5">{dayTotal.toFixed(1)}h</div>
                        )}
                      </div>

                      {/* Entries */}
                      <div className="flex-1 p-1 space-y-1 overflow-y-auto">
                        {entries.map((entry, index) => {
                          const c = projectColorMap[entry.project_id] || NEUTRAL_COLORS[0];
                          const startFmt = entry.start_time
                            ? (() => {
                                const [h, m] = String(entry.start_time).split(":").map(Number);
                                const d = new Date();
                                d.setHours(h || 0, m || 0);
                                return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                              })()
                            : null;

                          return (
                            <Draggable key={entry.id} draggableId={entry.id} index={index}>
                              {(prov, snap) => (
                                <div
                                  ref={prov.innerRef}
                                  {...prov.draggableProps}
                                  {...prov.dragHandleProps}
                                  className={`${c.bg} ${c.text} border-l-2 ${c.border} rounded-sm px-1.5 py-1 cursor-pointer hover:brightness-95 transition-all ${
                                    snap.isDragging ? "shadow-md ring-1 ring-gray-300" : ""
                                  }`}
                                  onClick={() => onEditEntry && onEditEntry(entry)}
                                >
                                  <div className="flex items-center gap-1">
                                    <span className="text-[12px] font-medium tabular-nums">{entry.hours}h</span>
                                    {startFmt && <span className="text-[10px] opacity-70">{startFmt}</span>}
                                  </div>
                                  <div className="text-[11px] font-medium truncate">{getProjectName(entry.project_id)}</div>
                                  {entry.description && (
                                    <div className="text-[10px] opacity-70 truncate">{entry.description}</div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}
