import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const PlanningCalendar = ({ 
  planningData, 
  salesmen, 
  onAssignmentChange, 
  onCapacityChange,
  className = '' 
}) => {
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [viewMode, setViewMode] = useState('gantt');

  const months = [
    { value: 0, label: 'November 2024' },
    { value: 1, label: 'December 2024' }
  ];

  const viewModes = [
    { value: 'gantt', label: 'Gantt View', icon: 'BarChart3' },
    { value: 'calendar', label: 'Calendar View', icon: 'Calendar' },
    { value: 'capacity', label: 'Capacity View', icon: 'Users' }
  ];

  const weeks = [
    { id: 'w1', label: 'Week 1', dates: 'Nov 4-8' },
    { id: 'w2', label: 'Week 2', dates: 'Nov 11-15' },
    { id: 'w3', label: 'Week 3', dates: 'Nov 18-22' },
    { id: 'w4', label: 'Week 4', dates: 'Nov 25-29' }
  ];

  const getCapacityColor = (used, total) => {
    const percentage = (used / total) * 100;
    if (percentage >= 90) return 'bg-error';
    if (percentage >= 70) return 'bg-warning';
    return 'bg-success';
  };

  const getConflictIndicator = (conflicts) => {
    if (conflicts > 0) {
      return (
        <div className="flex items-center space-x-1 text-error">
          <Icon name="AlertTriangle" size={12} />
          <span className="text-xs">{conflicts}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`bg-card border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Calendar Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">2-Month Planning Calendar</h3>
          <div className="flex items-center space-x-2">
            <Select
              options={months}
              value={selectedMonth}
              onChange={setSelectedMonth}
              className="w-40"
            />
            <Button variant="outline" size="sm">
              <Icon name="Download" size={16} />
            </Button>
          </div>
        </div>

        {/* View Mode Selector */}
        <div className="flex space-x-1 bg-muted p-1 rounded-md">
          {viewModes?.map((mode) => (
            <button
              key={mode?.value}
              onClick={() => setViewMode(mode?.value)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                viewMode === mode?.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={mode?.icon} size={16} />
              <span>{mode?.label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Calendar Content */}
      <div className="overflow-x-auto">
        {viewMode === 'gantt' && (
          <div className="min-w-[800px]">
            {/* Week Headers */}
            <div className="flex border-b border-border bg-muted/50">
              <div className="w-48 p-3 border-r border-border">
                <span className="text-sm font-medium text-foreground">Salesman</span>
              </div>
              {weeks?.map((week) => (
                <div key={week?.id} className="flex-1 p-3 border-r border-border last:border-r-0">
                  <div className="text-sm font-medium text-foreground">{week?.label}</div>
                  <div className="text-xs text-muted-foreground">{week?.dates}</div>
                </div>
              ))}
            </div>

            {/* Salesman Rows */}
            {salesmen?.map((salesman) => (
              <div key={salesman?.id} className="flex border-b border-border hover:bg-muted/30 transition-colors duration-200">
                <div className="w-48 p-3 border-r border-border">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${salesman?.available ? 'bg-success' : 'bg-error'}`}></div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{salesman?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Capacity: {salesman?.weeklyCapacity} visits/week
                      </div>
                    </div>
                  </div>
                </div>

                {weeks?.map((week) => {
                  const assignment = planningData?.find(
                    p => p?.salesmanId === salesman?.id && p?.weekId === week?.id
                  );
                  
                  return (
                    <div key={week?.id} className="flex-1 p-3 border-r border-border last:border-r-0">
                      {assignment ? (
                        <div className="space-y-2">
                          {assignment?.territories?.map((territory) => (
                            <div
                              key={territory?.id}
                              className="flex items-center justify-between p-2 bg-primary/10 border border-primary/20 rounded-md"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-foreground truncate">
                                  {territory?.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {territory?.plannedVisits} visits
                                </div>
                              </div>
                              {getConflictIndicator(territory?.conflicts)}
                            </div>
                          ))}
                          
                          {/* Capacity Bar */}
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Capacity</span>
                              <span className="text-foreground">
                                {assignment?.totalVisits}/{salesman?.weeklyCapacity}
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${getCapacityColor(
                                  assignment?.totalVisits,
                                  salesman?.weeklyCapacity
                                )}`}
                                style={{
                                  width: `${Math.min((assignment?.totalVisits / salesman?.weeklyCapacity) * 100, 100)}%`
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-16 border-2 border-dashed border-muted-foreground/30 rounded-md">
                          <span className="text-xs text-muted-foreground">No assignment</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {viewMode === 'capacity' && (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {salesmen?.map((salesman) => {
                const totalAssigned = planningData?.filter(p => p?.salesmanId === salesman?.id)?.reduce((sum, p) => sum + p?.totalVisits, 0);
                
                const maxCapacity = salesman?.weeklyCapacity * 8; // 2 months = 8 weeks
                
                return (
                  <div key={salesman?.id} className="bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <div className={`w-3 h-3 rounded-full ${salesman?.available ? 'bg-success' : 'bg-error'}`}></div>
                      <span className="font-medium text-foreground">{salesman?.name}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Assigned Visits</span>
                        <span className="text-foreground font-medium">{totalAssigned}</span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Max Capacity</span>
                        <span className="text-foreground font-medium">{maxCapacity}</span>
                      </div>
                      
                      <div className="w-full bg-muted rounded-full h-3 mt-2">
                        <div
                          className={`h-3 rounded-full transition-all duration-300 ${getCapacityColor(
                            totalAssigned,
                            maxCapacity
                          )}`}
                          style={{
                            width: `${Math.min((totalAssigned / maxCapacity) * 100, 100)}%`
                          }}
                        ></div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground text-center">
                        {Math.round((totalAssigned / maxCapacity) * 100)}% utilized
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* Calendar Footer */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-success rounded"></div>
              <span>Under 70%</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-warning rounded"></div>
              <span>70-90%</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-error rounded"></div>
              <span>Over 90%</span>
            </div>
          </div>
          
          <Button variant="outline" size="sm">
            <Icon name="Settings" size={16} />
            Optimize Schedule
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlanningCalendar;