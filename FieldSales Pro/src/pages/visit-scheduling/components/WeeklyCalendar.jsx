import React, { useState, useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const WeeklyCalendar = ({ 
  currentWeek, 
  onWeekChange, 
  scheduledVisits, 
  onVisitDrop, 
  onVisitClick,
  onOptimizeRoute,
  className = '' 
}) => {
  const [draggedVisit, setDraggedVisit] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);

  const weekDays = useMemo(() => {
    const days = [];
    const startDate = new Date(currentWeek);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date?.setDate(startDate?.getDate() + i);
      days?.push({
        date: date,
        dayName: date?.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date?.getDate(),
        isToday: date?.toDateString() === new Date()?.toDateString(),
        isWeekend: date?.getDay() === 0 || date?.getDay() === 6
      });
    }
    return days;
  }, [currentWeek]);

  const getVisitsForDay = (date) => {
    const dateStr = date?.toISOString()?.split('T')?.[0];
    return scheduledVisits?.filter(visit => visit?.date === dateStr);
  };

  const handleDragStart = (e, visit) => {
    setDraggedVisit(visit);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, dayDate) => {
    e?.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDay(dayDate?.toISOString()?.split('T')?.[0]);
  };

  const handleDragLeave = () => {
    setDragOverDay(null);
  };

  const handleDrop = (e, dayDate) => {
    e?.preventDefault();
    if (draggedVisit) {
      const newDate = dayDate?.toISOString()?.split('T')?.[0];
      onVisitDrop(draggedVisit?.id, newDate);
    }
    setDraggedVisit(null);
    setDragOverDay(null);
  };

  const getTotalTravelTime = (visits) => {
    return visits?.reduce((total, visit) => total + (visit?.estimatedTravelTime || 0), 0);
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'border-l-error bg-error/5';
      case 'medium': return 'border-l-warning bg-warning/5';
      default: return 'border-l-muted-foreground bg-muted/5';
    }
  };

  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-foreground">Weekly Schedule</h3>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onWeekChange(-1)}
              >
                <Icon name="ChevronLeft" size={20} />
              </Button>
              <span className="text-sm font-medium text-muted-foreground px-3">
                {currentWeek?.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onWeekChange(1)}
              >
                <Icon name="ChevronRight" size={20} />
              </Button>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={onOptimizeRoute}
            iconName="Route"
            iconPosition="left"
          >
            Optimize Routes
          </Button>
        </div>
      </div>
      {/* Calendar Grid */}
      <div className="p-4">
        <div className="grid grid-cols-7 gap-2">
          {weekDays?.map((day) => {
            const dayVisits = getVisitsForDay(day?.date);
            const totalTravelTime = getTotalTravelTime(dayVisits);
            const isDragOver = dragOverDay === day?.date?.toISOString()?.split('T')?.[0];

            return (
              <div
                key={day?.date?.toISOString()}
                className={`min-h-[300px] border border-border rounded-lg p-3 transition-all duration-200 ${
                  day?.isWeekend ? 'bg-muted/30' : 'bg-background'
                } ${isDragOver ? 'border-primary bg-primary/10' : ''}`}
                onDragOver={(e) => handleDragOver(e, day?.date)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day?.date)}
              >
                {/* Day Header */}
                <div className="mb-3">
                  <div className={`text-sm font-medium ${
                    day?.isToday ? 'text-primary' : 'text-foreground'
                  }`}>
                    {day?.dayName}
                  </div>
                  <div className={`text-lg font-semibold ${
                    day?.isToday ? 'text-primary' : 'text-foreground'
                  }`}>
                    {day?.dayNumber}
                  </div>
                  {dayVisits?.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {dayVisits?.length} visits • {formatTime(totalTravelTime)} travel
                    </div>
                  )}
                </div>
                {/* Visit Slots */}
                <div className="space-y-2">
                  {dayVisits?.map((visit, index) => (
                    <div
                      key={visit?.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, visit)}
                      onClick={() => onVisitClick(visit)}
                      className={`p-2 rounded-md border-l-4 cursor-move hover:shadow-sm transition-all duration-200 ${getPriorityColor(visit?.priority)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {visit?.customerName}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {visit?.company}
                          </div>
                          {visit?.timeSlot && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {visit?.timeSlot}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          <Icon name="GripVertical" size={14} className="text-muted-foreground" />
                        </div>
                      </div>

                      {visit?.estimatedTravelTime > 0 && (
                        <div className="flex items-center space-x-1 mt-2 text-xs text-muted-foreground">
                          <Icon name="Clock" size={12} />
                          <span>{formatTime(visit?.estimatedTravelTime)} travel</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Drop Zone */}
                  {dayVisits?.length === 0 && (
                    <div className="h-20 border-2 border-dashed border-muted-foreground/30 rounded-md flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">
                        Drop visits here
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Footer Stats */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-foreground">
              {scheduledVisits?.length}
            </div>
            <div className="text-xs text-muted-foreground">Total Visits</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-foreground">
              {formatTime(getTotalTravelTime(scheduledVisits))}
            </div>
            <div className="text-xs text-muted-foreground">Travel Time</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-foreground">
              {Math.round((scheduledVisits?.filter(v => v?.priority === 'high')?.length / Math.max(scheduledVisits?.length, 1)) * 100)}%
            </div>
            <div className="text-xs text-muted-foreground">High Priority</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyCalendar;