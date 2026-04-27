import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/ui/Header';
import TerritoryMap from './components/TerritoryMap';
import PlanningCalendar from './components/PlanningCalendar';
import TerritoryDetails from './components/TerritoryDetails';
import PlanningControls from './components/PlanningControls';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import {
  fetchSalesmen,
  fetchSchedules,
  fetchTerritories,
  fetchTerritoryAssignments,
  saveSchedule,
  saveTerritory,
  saveTerritoryAssignment,
  updateScheduleStatus,
} from '../../utils/bootApi';

function withDefaultBounds(index) {
  const presets = [
    { x: 15, y: 20, width: 20, height: 15 },
    { x: 40, y: 35, width: 18, height: 12 },
    { x: 65, y: 25, width: 22, height: 18 },
    { x: 20, y: 60, width: 25, height: 20 },
    { x: 50, y: 58, width: 18, height: 14 },
    { x: 72, y: 52, width: 16, height: 16 },
  ];

  return presets[index % presets.length];
}

function mapTerritoryToUi(rawTerritory, index) {
  return {
    ...rawTerritory,
    id: String(rawTerritory?.id || `territory-${index}`),
    name: String(rawTerritory?.name || `Περιοχή ${index + 1}`),
    visitLimit: Number(rawTerritory?.visitLimit || 20),
    priority: String(rawTerritory?.priority || 'medium').toLowerCase(),
    postcodes: Array.isArray(rawTerritory?.postcodes) ? rawTerritory.postcodes : [],
    customerCount: Number(rawTerritory?.customerCount || 0),
    avgDistance: Number(rawTerritory?.avgDistance || 0),
    estimatedTime: Number(rawTerritory?.estimatedTime || 0),
    bounds: rawTerritory?.bounds || withDefaultBounds(index),
    conflicts: Array.isArray(rawTerritory?.conflicts) ? rawTerritory.conflicts : [],
    assignedSalesman: rawTerritory?.assignedSalesman || null,
  };
}

function mapSalesmanToUi(rawSalesman) {
  return {
    id: String(rawSalesman?.id || ''),
    name: String(rawSalesman?.name || rawSalesman?.email || 'Salesman'),
    available: true,
    assignedTerritories: Number(rawSalesman?.assignedTerritories || 0),
    maxTerritories: Number(rawSalesman?.maxTerritories || 5),
    weeklyCapacity: Number(rawSalesman?.weeklyCapacity || 30),
  };
}

function toDateOnlyString(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getMonday(date) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = next.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setUTCDate(next.getUTCDate() + diff);
  return next;
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat('el-GR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatWeekRangeLabel(startDate, endDate) {
  const start = new Intl.DateTimeFormat('el-GR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(startDate);
  const end = new Intl.DateTimeFormat('el-GR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(endDate);
  return `${start} - ${end}`;
}

function getPlanningWindow(referenceDate = new Date()) {
  const currentMonthStart = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1)
  );
  const nextMonthStart = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1)
  );
  const baseWeekStart = getMonday(currentMonthStart);

  const months = [
    {
      value: 0,
      label: formatMonthLabel(currentMonthStart),
      monthKey: toDateOnlyString(currentMonthStart).slice(0, 7),
    },
    {
      value: 1,
      label: formatMonthLabel(nextMonthStart),
      monthKey: toDateOnlyString(nextMonthStart).slice(0, 7),
    },
  ];

  const weeks = Array.from({ length: 8 }, (_, index) => {
    const startDate = addDays(baseWeekStart, index * 7);
    const endDate = addDays(startDate, 4);
    const monthIndex = index < 4 ? 0 : 1;
    const weekNumber = monthIndex === 0 ? index + 1 : index - 3;

    return {
      id: `m${monthIndex + 1}-w${weekNumber}`,
      label: `Εβδομάδα ${weekNumber}`,
      dates: formatWeekRangeLabel(startDate, endDate),
      monthIndex,
      monthKey: months[monthIndex].monthKey,
      startDate: toDateOnlyString(startDate),
      endDate: toDateOnlyString(endDate),
    };
  });

  return {
    months,
    weeks,
    rangeStart: weeks[0]?.startDate || '',
    rangeEnd: weeks[weeks.length - 1]?.endDate || '',
  };
}

function resolveWeekForAssignment(dateLike, weeks) {
  const date = toDateOnlyString(dateLike);
  const matchedWeek = weeks.find((week) => date && date >= week.startDate && date <= week.endDate);
  return matchedWeek || weeks[0] || null;
}

function getScheduleRowKey(salesmanId, weekStartDate) {
  return `${salesmanId}:${weekStartDate}`;
}

function derivePlanningStatus(scheduleItems) {
  if (!Array.isArray(scheduleItems) || scheduleItems.length === 0) {
    return 'draft';
  }

  if (scheduleItems.some((item) => item?.status === 'rejected')) {
    return 'rejected';
  }

  if (scheduleItems.every((item) => item?.status === 'approved')) {
    return 'approved';
  }

  if (scheduleItems.some((item) => item?.status === 'pending')) {
    return 'pending';
  }

  return 'draft';
}

function buildPlanningRows(assignments, territories, weeks, scheduleIndex) {
  const territoryById = new Map(territories.map((territory) => [territory.id, territory]));
  const grouped = new Map();

  assignments.forEach((assignment) => {
    if (!assignment?.salesmanId || !assignment?.territoryId) {
      return;
    }

    const territory = territoryById.get(assignment.territoryId);
    const week = resolveWeekForAssignment(assignment.startDate, weeks);
    if (!territory || !week) {
      return;
    }

    const rowKey = getScheduleRowKey(assignment.salesmanId, week.startDate);
    const persisted = scheduleIndex.get(rowKey);
    const existing = grouped.get(rowKey) || {
      id: persisted?.id || null,
      rowKey,
      salesmanId: assignment.salesmanId,
      salesmanName: assignment.salesmanName || persisted?.salesmanName || null,
      weekId: week.id,
      weekKey: week.id,
      weekStartDate: week.startDate,
      weekEndDate: week.endDate,
      monthKey: week.monthKey,
      status: persisted?.status || 'draft',
      updatedAt: persisted?.updatedAt || null,
      territories: [],
      totalVisits: 0,
    };

    const plannedVisits = Number(territory.visitLimit || 0);
    existing.territories.push({
      id: territory.id,
      name: territory.name,
      plannedVisits,
      conflicts: Array.isArray(territory.conflicts) ? territory.conflicts.length : 0,
    });
    existing.totalVisits += plannedVisits;
    grouped.set(rowKey, existing);
  });

  return Array.from(grouped.values()).sort((left, right) =>
    `${left.weekStartDate}:${left.salesmanId}`.localeCompare(`${right.weekStartDate}:${right.salesmanId}`)
  );
}

const TerritoryPlanning = () => {
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [planningStatus, setPlanningStatus] = useState('draft');
  const [showMobilePanel, setShowMobilePanel] = useState('map');
  const [territories, setTerritories] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [scheduleItems, setScheduleItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [error, setError] = useState('');

  const planningWindow = useMemo(() => getPlanningWindow(new Date()), []);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError('');

        const [territoriesResult, assignmentsResult, salesmenResult, schedulesResult] =
          await Promise.all([
            fetchTerritories({ active: true }),
            fetchTerritoryAssignments(),
            fetchSalesmen(),
            fetchSchedules({
              rangeStart: planningWindow.rangeStart,
              rangeEnd: planningWindow.rangeEnd,
            }),
          ]);

        if (!isMounted) {
          return;
        }

        const territoryItems = (territoriesResult?.items || []).map((item, index) =>
          mapTerritoryToUi(item, index)
        );
        const assignmentItems = Array.isArray(assignmentsResult?.items)
          ? assignmentsResult.items
          : [];
        const persistedSchedules = Array.isArray(schedulesResult?.items) ? schedulesResult.items : [];

        const assignmentByTerritory = new Map();
        assignmentItems.forEach((assignment) => {
          if (!assignment?.territoryId) {
            return;
          }

          const existing = assignmentByTerritory.get(assignment.territoryId);
          if (!existing) {
            assignmentByTerritory.set(assignment.territoryId, assignment);
            return;
          }

          const existingDate = new Date(existing.updatedAt || 0).getTime();
          const incomingDate = new Date(assignment.updatedAt || 0).getTime();
          if (incomingDate >= existingDate) {
            assignmentByTerritory.set(assignment.territoryId, assignment);
          }
        });

        const mergedTerritories = territoryItems.map((territory) => {
          const assignment = assignmentByTerritory.get(territory.id);
          return assignment
            ? { ...territory, assignedSalesman: assignment.salesmanId }
            : territory;
        });

        const salesmanItems = Array.isArray(salesmenResult?.items)
          ? salesmenResult.items.map(mapSalesmanToUi)
          : [];

        const territoryCountBySalesman = mergedTerritories.reduce((acc, territory) => {
          if (!territory.assignedSalesman) {
            return acc;
          }

          acc[territory.assignedSalesman] = (acc[territory.assignedSalesman] || 0) + 1;
          return acc;
        }, {});

        const enrichedSalesmen = salesmanItems.map((salesman) => ({
          ...salesman,
          assignedTerritories: territoryCountBySalesman[salesman.id] || 0,
        }));

        setTerritories(mergedTerritories);
        setAssignments(assignmentItems);
        setSalesmen(enrichedSalesmen);
        setScheduleItems(persistedSchedules);
        setPlanningStatus(derivePlanningStatus(persistedSchedules));
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(loadError?.message || 'Αδυναμία φόρτωσης σχεδιασμού περιοχών.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [planningWindow.rangeEnd, planningWindow.rangeStart]);

  const scheduleIndex = useMemo(() => {
    const nextIndex = new Map();
    scheduleItems.forEach((item) => {
      if (!item?.salesmanId || !item?.weekStartDate) {
        return;
      }

      nextIndex.set(getScheduleRowKey(item.salesmanId, item.weekStartDate), item);
    });
    return nextIndex;
  }, [scheduleItems]);

  const planningData = useMemo(
    () => buildPlanningRows(assignments, territories, planningWindow.weeks, scheduleIndex),
    [assignments, territories, planningWindow.weeks, scheduleIndex]
  );

  const assignedCount = useMemo(
    () => territories.filter((territory) => territory?.assignedSalesman).length,
    [territories]
  );
  const unassignedCount = territories.length - assignedCount;
  const conflictsCount = useMemo(
    () => territories.reduce((sum, territory) => sum + (territory?.conflicts?.length || 0), 0),
    [territories]
  );
  const totalPlannedVisits = useMemo(
    () => planningData.reduce((sum, item) => sum + (item?.totalVisits || 0), 0),
    [planningData]
  );

  const handleTerritorySelect = (territory) => {
    setSelectedTerritory(territory);
    if (window.innerWidth < 1024) {
      setShowMobilePanel('details');
    }
  };

  const handleSalesmanAssign = async (territoryId, salesmanId) => {
    const salesman = salesmen.find((candidate) => candidate.id === salesmanId);

    try {
      const response = await saveTerritoryAssignment({
        territoryId,
        salesmanId,
        salesmanName: salesman?.name || null,
        status: 'active',
        startDate: planningWindow.rangeStart,
        endDate: planningWindow.rangeEnd,
      });

      if (response?.item) {
        setAssignments((prev) => {
          const next = prev.filter((assignment) => assignment.territoryId !== territoryId);
          return [...next, response.item];
        });
      }

      setTerritories((prev) =>
        prev?.map((territory) =>
          territory?.id === territoryId
            ? { ...territory, assignedSalesman: salesmanId }
            : territory
        )
      );
      setPlanningStatus('draft');
      setError('');
    } catch (saveError) {
      setError(saveError?.message || 'Αποτυχία αποθήκευσης ανάθεσης πωλητή.');
    }
  };

  const handleTerritoryUpdate = async (territoryId, updates) => {
    try {
      const territory = territories.find((candidate) => candidate.id === territoryId);
      if (!territory) {
        return;
      }

      const payload = { ...territory, ...updates, id: territoryId };
      const response = await saveTerritory(payload);
      const saved = response?.item || payload;

      setTerritories((prev) =>
        prev?.map((candidate, index) =>
          candidate?.id === territoryId ? mapTerritoryToUi(saved, index) : candidate
        )
      );
      setPlanningStatus('draft');
      setError('');
    } catch (saveError) {
      setError(saveError?.message || 'Αποτυχία αποθήκευσης περιοχής.');
    }
  };

  const handleBulkAssign = async (salesmanId, territoryIds) => {
    await Promise.all(
      territoryIds.map((territoryId) => handleSalesmanAssign(territoryId, salesmanId))
    );
  };

  const handleOptimize = (settings) => {
    console.log('Optimizing with settings:', settings);
  };

  const handleExport = (format) => {
    console.log('Exporting in format:', format);
  };

  const persistPlanningRows = async (status = 'draft') => {
    const responses = await Promise.all(
      planningData.map((row) =>
        saveSchedule({
          id: row.id,
          salesmanId: row.salesmanId,
          salesmanName:
            salesmen.find((salesman) => salesman.id === row.salesmanId)?.name || row.salesmanName,
          weekKey: row.weekKey,
          weekStartDate: row.weekStartDate,
          weekEndDate: row.weekEndDate,
          monthKey: row.monthKey,
          status,
          territories: row.territories,
        })
      )
    );

    const savedItems = responses.map((response) => response?.item).filter(Boolean);
    setScheduleItems((prev) => {
      const nextByKey = new Map(
        prev.map((item) => [getScheduleRowKey(item.salesmanId, item.weekStartDate), item])
      );
      savedItems.forEach((item) => {
        nextByKey.set(getScheduleRowKey(item.salesmanId, item.weekStartDate), item);
      });
      return Array.from(nextByKey.values());
    });
    setLastSavedAt(new Date());
    return savedItems;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await Promise.all(
        territories.map((territory) =>
          saveTerritory({
            id: territory.id,
            name: territory.name,
            code: territory.code,
            visitLimit: territory.visitLimit,
            priority: territory.priority,
            postcodes: territory.postcodes,
            customerCount: territory.customerCount,
            assignedSalesman: territory.assignedSalesman || null,
          })
        )
      );
      await persistPlanningRows('draft');
      setPlanningStatus('draft');
      setError('');
    } catch (saveError) {
      setError(saveError?.message || 'Αποτυχία αποθήκευσης σχεδιασμού.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitApproval = async () => {
    try {
      setSaving(true);
      const savedItems = await persistPlanningRows('draft');
      const statusResponses = await Promise.all(
        savedItems.map((item) => updateScheduleStatus(item.id, 'pending'))
      );
      const updatedItems = statusResponses.map((response) => response?.item).filter(Boolean);
      setScheduleItems((prev) => {
        const nextByKey = new Map(
          prev.map((item) => [getScheduleRowKey(item.salesmanId, item.weekStartDate), item])
        );
        updatedItems.forEach((item) => {
          nextByKey.set(getScheduleRowKey(item.salesmanId, item.weekStartDate), item);
        });
        return Array.from(nextByKey.values());
      });
      setPlanningStatus('pending');
      setLastSavedAt(new Date());
      setError('');
    } catch (submitError) {
      setError(submitError?.message || 'Αποτυχία υποβολής για έγκριση.');
    } finally {
      setSaving(false);
    }
  };

  const mobileNavItems = [
    { id: 'map', label: 'Χάρτης', icon: 'Map' },
    { id: 'calendar', label: 'Ημερολόγιο', icon: 'Calendar' },
    { id: 'details', label: 'Λεπτομέρειες', icon: 'Info' },
    { id: 'controls', label: 'Έλεγχοι', icon: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-16">
        <div className="hidden lg:block">
          <div className="h-screen flex">
            <div className="flex-1 flex flex-col p-6 space-y-6">
              <TerritoryMap
                territories={territories}
                salesmen={salesmen}
                selectedTerritory={selectedTerritory}
                onTerritorySelect={handleTerritorySelect}
                onSalesmanAssign={handleSalesmanAssign}
                className="flex-1"
              />

              <PlanningCalendar
                planningData={planningData}
                salesmen={salesmen}
                months={planningWindow.months}
                weeks={planningWindow.weeks}
                onExport={handleExport}
                className="h-80"
              />
            </div>

            <div className="w-96 flex flex-col p-6 space-y-6 border-l border-border">
              {loading && (
                <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
                  Φόρτωση δεδομένων σχεδιασμού...
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
                  {error}
                </div>
              )}

              <TerritoryDetails
                territory={selectedTerritory}
                salesmen={salesmen}
                onUpdate={handleTerritoryUpdate}
                onClose={() => setSelectedTerritory(null)}
                className="flex-1"
              />

              <PlanningControls
                salesmen={salesmen}
                territories={territories}
                stats={{
                  territoryCount: territories.length,
                  salesmanCount: salesmen.length,
                  assignedCount,
                  conflictsCount,
                  totalPlannedVisits,
                }}
                lastSavedAt={lastSavedAt}
                saving={saving}
                onBulkAssign={handleBulkAssign}
                onOptimize={handleOptimize}
                onExport={handleExport}
                onSave={handleSave}
                onSubmitApproval={handleSubmitApproval}
                planningStatus={planningStatus}
                className="h-auto"
              />
            </div>
          </div>
        </div>

        <div className="lg:hidden">
          <div className="sticky top-16 z-40 bg-card border-b border-border">
            <div className="flex">
              {mobileNavItems?.map((item) => (
                <button
                  key={item?.id}
                  onClick={() => setShowMobilePanel(item?.id)}
                  className={`flex-1 flex flex-col items-center py-3 px-2 transition-colors duration-200 ${
                    showMobilePanel === item?.id
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon name={item?.icon} size={20} />
                  <span className="text-xs mt-1">{item?.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            {showMobilePanel === 'map' && (
              <TerritoryMap
                territories={territories}
                salesmen={salesmen}
                selectedTerritory={selectedTerritory}
                onTerritorySelect={handleTerritorySelect}
                onSalesmanAssign={handleSalesmanAssign}
                className="h-96"
              />
            )}

            {showMobilePanel === 'calendar' && (
              <PlanningCalendar
                planningData={planningData}
                salesmen={salesmen}
                months={planningWindow.months}
                weeks={planningWindow.weeks}
                onExport={handleExport}
                className="h-auto"
              />
            )}

            {showMobilePanel === 'details' && (
              <TerritoryDetails
                territory={selectedTerritory}
                salesmen={salesmen}
                onUpdate={handleTerritoryUpdate}
                onClose={() => setSelectedTerritory(null)}
                className="h-auto"
              />
            )}

            {showMobilePanel === 'controls' && (
              <PlanningControls
                salesmen={salesmen}
                territories={territories}
                stats={{
                  territoryCount: territories.length,
                  salesmanCount: salesmen.length,
                  assignedCount,
                  conflictsCount,
                  totalPlannedVisits,
                }}
                lastSavedAt={lastSavedAt}
                saving={saving}
                onBulkAssign={handleBulkAssign}
                onOptimize={handleOptimize}
                onExport={handleExport}
                onSave={handleSave}
                onSubmitApproval={handleSubmitApproval}
                planningStatus={planningStatus}
                className="h-auto"
              />
            )}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 lg:hidden">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                <span className="text-muted-foreground">{assignedCount} Ανατεθειμένες</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-warning rounded-full"></div>
                <span className="text-muted-foreground">{unassignedCount} Χωρίς ανάθεση</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-error rounded-full"></div>
                <span className="text-muted-foreground">{conflictsCount} Συγκρούσεις</span>
              </div>
            </div>

            <Button variant="default" size="sm" onClick={handleSave} disabled={saving}>
              <Icon name="Save" size={16} />
              Αποθήκευση
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerritoryPlanning;
