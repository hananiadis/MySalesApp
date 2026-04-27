import React, { useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

function getCapacityColor(used, total) {
  if (!total) {
    return 'bg-success';
  }

  const percentage = (used / total) * 100;
  if (percentage >= 90) return 'bg-error';
  if (percentage >= 70) return 'bg-warning';
  return 'bg-success';
}

function getStatusMeta(status) {
  switch (status) {
    case 'approved':
      return { label: 'Εγκεκριμένο', className: 'bg-success/10 text-success' };
    case 'pending':
      return { label: 'Σε έγκριση', className: 'bg-warning/10 text-warning' };
    case 'rejected':
      return { label: 'Απορρίφθηκε', className: 'bg-error/10 text-error' };
    default:
      return { label: 'Πρόχειρο', className: 'bg-muted text-muted-foreground' };
  }
}

const PlanningCalendar = ({
  planningData = [],
  salesmen = [],
  months = [],
  weeks = [],
  onExport,
  className = '',
}) => {
  const [selectedMonth, setSelectedMonth] = useState(months[0]?.value ?? 0);
  const [viewMode, setViewMode] = useState('gantt');

  const viewModes = [
    { value: 'gantt', label: 'Προβολή Gantt', icon: 'BarChart3' },
    { value: 'calendar', label: 'Προβολή Ημερολογίου', icon: 'Calendar' },
    { value: 'capacity', label: 'Προβολή Χωρητικότητας', icon: 'Users' },
  ];

  const visibleWeeks = useMemo(
    () => weeks.filter((week) => week.monthIndex === Number(selectedMonth)),
    [selectedMonth, weeks]
  );

  const totalsBySalesman = useMemo(() => {
    return salesmen.reduce((acc, salesman) => {
      const totalAssigned = planningData
        .filter((item) => item?.salesmanId === salesman?.id)
        .reduce((sum, item) => sum + (item?.totalVisits || 0), 0);
      acc[salesman.id] = totalAssigned;
      return acc;
    }, {});
  }, [planningData, salesmen]);

  return (
    <div className={`bg-card border border-border rounded-lg overflow-hidden ${className}`}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Ημερολόγιο Σχεδιασμού 2 Μηνών</h3>
          <div className="flex items-center space-x-2">
            <Select
              options={months}
              value={selectedMonth}
              onChange={setSelectedMonth}
              className="w-48"
            />
            <Button variant="outline" size="sm" onClick={() => onExport?.('csv')}>
              <Icon name="Download" size={16} />
            </Button>
          </div>
        </div>

        <div className="flex space-x-1 bg-muted p-1 rounded-md">
          {viewModes.map((mode) => (
            <button
              key={mode.value}
              onClick={() => setViewMode(mode.value)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                viewMode === mode.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={mode.icon} size={16} />
              <span>{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        {viewMode === 'gantt' && (
          <div className="min-w-[920px]">
            <div className="flex border-b border-border bg-muted/50">
              <div className="w-52 p-3 border-r border-border">
                <span className="text-sm font-medium text-foreground">Πωλητής</span>
              </div>
              {visibleWeeks.map((week) => (
                <div key={week.id} className="flex-1 p-3 border-r border-border last:border-r-0">
                  <div className="text-sm font-medium text-foreground">{week.label}</div>
                  <div className="text-xs text-muted-foreground">{week.dates}</div>
                </div>
              ))}
            </div>

            {salesmen.map((salesman) => (
              <div key={salesman.id} className="flex border-b border-border hover:bg-muted/30 transition-colors duration-200">
                <div className="w-52 p-3 border-r border-border">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${salesman.available ? 'bg-success' : 'bg-error'}`} />
                    <div>
                      <div className="text-sm font-medium text-foreground">{salesman.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Χωρητικότητα: {salesman.weeklyCapacity} επισκέψεις/εβδομάδα
                      </div>
                    </div>
                  </div>
                </div>

                {visibleWeeks.map((week) => {
                  const assignment = planningData.find(
                    (item) => item?.salesmanId === salesman.id && item?.weekStartDate === week.startDate
                  );
                  const statusMeta = getStatusMeta(assignment?.status);

                  return (
                    <div key={week.id} className="flex-1 p-3 border-r border-border last:border-r-0">
                      {assignment ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                            <span className="text-xs text-muted-foreground">{assignment.totalVisits} επισκ.</span>
                          </div>

                          {assignment.territories.map((territory) => (
                            <div
                              key={territory.id}
                              className="flex items-center justify-between p-2 bg-primary/10 border border-primary/20 rounded-md"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-foreground truncate">
                                  {territory.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {territory.plannedVisits} επισκέψεις
                                </div>
                              </div>
                              {territory.conflicts > 0 && (
                                <div className="flex items-center space-x-1 text-error">
                                  <Icon name="AlertTriangle" size={12} />
                                  <span className="text-xs">{territory.conflicts}</span>
                                </div>
                              )}
                            </div>
                          ))}

                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Χωρητικότητα</span>
                              <span className="text-foreground">
                                {assignment.totalVisits}/{salesman.weeklyCapacity}
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${getCapacityColor(
                                  assignment.totalVisits,
                                  salesman.weeklyCapacity
                                )}`}
                                style={{
                                  width: `${Math.min((assignment.totalVisits / salesman.weeklyCapacity) * 100, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-20 border-2 border-dashed border-muted-foreground/30 rounded-md">
                          <span className="text-xs text-muted-foreground">Χωρίς ανάθεση</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {viewMode === 'calendar' && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {visibleWeeks.map((week) => {
              const weekAssignments = planningData.filter((item) => item?.weekStartDate === week.startDate);
              return (
                <div key={week.id} className="border border-border rounded-lg p-4 bg-muted/20">
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-foreground">{week.label}</div>
                    <div className="text-xs text-muted-foreground">{week.dates}</div>
                  </div>
                  <div className="space-y-2">
                    {weekAssignments.length === 0 ? (
                      <div className="text-xs text-muted-foreground">Δεν υπάρχουν προγραμματισμένες αναθέσεις.</div>
                    ) : (
                      weekAssignments.map((item) => {
                        const statusMeta = getStatusMeta(item.status);
                        return (
                          <div key={item.rowKey} className="rounded-md border border-border bg-card p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-foreground">{item.salesmanName}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusMeta.className}`}>
                                {statusMeta.label}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.territories.length} περιοχές, {item.totalVisits} επισκέψεις
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'capacity' && (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {salesmen.map((salesman) => {
                const totalAssigned = totalsBySalesman[salesman.id] || 0;
                const maxCapacity = salesman.weeklyCapacity * weeks.length;
                return (
                  <div key={salesman.id} className="bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <div className={`w-3 h-3 rounded-full ${salesman.available ? 'bg-success' : 'bg-error'}`} />
                      <span className="font-medium text-foreground">{salesman.name}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Ανατεθειμένες Επισκέψεις</span>
                        <span className="text-foreground font-medium">{totalAssigned}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Μέγιστη Χωρητικότητα</span>
                        <span className="text-foreground font-medium">{maxCapacity}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 mt-2">
                        <div
                          className={`h-3 rounded-full transition-all duration-300 ${getCapacityColor(
                            totalAssigned,
                            maxCapacity
                          )}`}
                          style={{ width: `${Math.min((totalAssigned / maxCapacity) * 100, 100)}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground text-center">
                        {maxCapacity > 0 ? Math.round((totalAssigned / maxCapacity) * 100) : 0}% αξιοποιημένο
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-success rounded" />
              <span>Κάτω από 70%</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-warning rounded" />
              <span>70-90%</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-error rounded" />
              <span>Πάνω από 90%</span>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => onExport?.('excel')}>
            <Icon name="FileSpreadsheet" size={16} />
            Εξαγωγή Προγράμματος
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlanningCalendar;
