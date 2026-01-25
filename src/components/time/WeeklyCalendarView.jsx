import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function WeeklyCalendarView({ timeEntries, projects, users, onEditEntry }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(today.setDate(diff));
  });

  // Time slots from 6 AM to 10 PM (more reasonable work hours)
  const timeSlots = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM to 10 PM

  const getWeekDays = (startDate) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const previousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const thisWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(today.setDate(diff)));
  };

  const weekDays = getWeekDays(currentWeekStart);
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const getEntriesForDay = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return timeEntries.filter(entry => entry.date === dateStr);
  };

  const getProjectName = (projectId) => {
    return projects.find(p => p.id === projectId)?.name || "Unknown";
  };

  const getUserName = (userId) => {
    return users.find(u => u.id === userId)?.full_name || "Unknown";
  };

  const getProjectColor = (projectId) => {
    const colors = [
      { bg: 'bg-blue-500', text: 'text-white' },
      { bg: 'bg-green-500', text: 'text-white' },
      { bg: 'bg-purple-500', text: 'text-white' },
      { bg: 'bg-orange-500', text: 'text-white' },
      { bg: 'bg-pink-500', text: 'text-white' },
      { bg: 'bg-indigo-500', text: 'text-white' },
      { bg: 'bg-red-500', text: 'text-white' },
      { bg: 'bg-teal-500', text: 'text-white' },
    ];
    const index = projects.findIndex(p => p.id === projectId);
    return colors[index % colors.length];
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const totalHoursForDay = (date) => {
    return getEntriesForDay(date).reduce((sum, entry) => sum + (entry.hours || 0), 0);
  };

  const formatHour = (hour) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour > 12) return `${hour - 12} PM`;
    return `${hour} AM`;
  };

  // Helper to extract time from ISO string or HH:mm format
  const extractTimeFromISO = (isoString) => {
    if (!isoString) return null;
    try {
      const date = new Date(isoString);
      return date.getHours() + date.getMinutes() / 60;
    } catch (e) {
      // If it's in HH:mm format
      if (isoString.includes(':')) {
        const [hours, minutes] = isoString.split(':').map(Number);
        return hours + minutes / 60;
      }
      return null;
    }
  };

  // Calculate position for time entries based on actual start/end times
  const getTimeBlockStyle = (entry, dayEntries) => {
    let startHour = extractTimeFromISO(entry.start_time);
    let endHour = extractTimeFromISO(entry.end_time);
    
    // Fallback: if no start_time, position entries evenly throughout the day
    if (startHour === null) {
      const entryIndex = dayEntries.findIndex(e => e.id === entry.id);
      const totalEntries = dayEntries.length;
      const workingStartHour = 8;
      const workingHours = 9; // 8 AM to 5 PM
      const hoursPerEntry = workingHours / totalEntries;
      startHour = workingStartHour + (entryIndex * hoursPerEntry);
      endHour = startHour + (entry.hours || 1);
    }
    
    // Calculate position relative to 6 AM (start of calendar)
    const startOffset = (startHour - 6) * 60; // In pixels (60px per hour)
    const height = ((endHour || (startHour + entry.hours)) - startHour) * 60;
    
    return {
      top: `${startOffset}px`,
      height: `${Math.max(height, 50)}px`, // Minimum 50px for readability
    };
  };

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={previousWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={thisWeek}>
            This Week
          </Button>
          <Button variant="outline" size="sm" onClick={nextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-lg font-semibold text-gray-900">
          {currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[1000px]">
              {/* Header with days */}
              <div className="grid grid-cols-8 border-b bg-gray-50">
                <div className="p-2 border-r"></div>
                {weekDays.map((day, index) => (
                  <div 
                    key={index} 
                    className={`p-3 text-center border-r ${isToday(day) ? 'bg-indigo-50' : ''}`}
                  >
                    <div className="text-xs font-medium text-gray-500 uppercase">
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={`text-2xl font-bold mt-1 ${isToday(day) ? 'text-indigo-600' : 'text-gray-900'}`}>
                      {day.getDate()}
                    </div>
                    {totalHoursForDay(day) > 0 && (
                      <div className="text-xs text-gray-600 mt-1">
                        {totalHoursForDay(day).toFixed(1)}h
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Time slots grid */}
              <div className="relative">
                {timeSlots.map((hour) => (
                  <div key={hour} className="grid grid-cols-8 border-b" style={{ height: '60px' }}>
                    {/* Time label */}
                    <div className="p-2 text-xs text-gray-500 text-right pr-4 border-r bg-gray-50">
                      {formatHour(hour)}
                    </div>
                    
                    {/* Day columns */}
                    {weekDays.map((day, dayIndex) => (
                      <div 
                        key={dayIndex} 
                        className={`border-r relative ${isToday(day) ? 'bg-indigo-50 bg-opacity-30' : ''}`}
                      />
                    ))}
                  </div>
                ))}

                {/* Time entry blocks overlay */}
                {weekDays.map((day, dayIndex) => {
                  const dayEntries = getEntriesForDay(day);
                  return (
                    <div
                      key={dayIndex}
                      className="absolute top-0 pointer-events-none"
                      style={{
                        left: `${((dayIndex + 1) / 8) * 100}%`,
                        width: `${(1 / 8) * 100}%`,
                        height: '100%',
                      }}
                    >
                      {dayEntries.map((entry) => {
                        const style = getTimeBlockStyle(entry, dayEntries);
                        const colors = getProjectColor(entry.project_id);
                        
                        return (
                          <div
                            key={entry.id}
                            className={`absolute left-1 right-1 ${colors.bg} ${colors.text} rounded p-2 text-xs shadow-md cursor-pointer hover:shadow-lg transition-shadow pointer-events-auto overflow-hidden`}
                            style={style}
                            onClick={() => onEditEntry && onEditEntry(entry)}
                          >
                            <div className="font-semibold line-clamp-1">
                              {getProjectName(entry.project_id)}
                            </div>
                            <div className="text-xs opacity-90 mt-1">
                              {entry.hours}h
                            </div>
                            {entry.description && (
                              <div className="text-xs opacity-80 line-clamp-2 mt-1">
                                {entry.description}
                              </div>
                            )}
                            {entry.billable && (
                              <Badge className="mt-1 text-xs bg-white bg-opacity-20">
                                Billable
                              </Badge>
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
        </CardContent>
      </Card>

      {/* Week Summary */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-600">Week Total</div>
            <div className="text-2xl font-bold text-gray-900">
              {weekDays.reduce((sum, day) => sum + totalHoursForDay(day), 0).toFixed(1)}h
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}