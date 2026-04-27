import React, { useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

function getStatusMeta(status) {
  switch (status) {
    case 'approved':
      return { label: 'approved', color: 'text-success', icon: 'CheckCircle' };
    case 'pending':
      return { label: 'pending', color: 'text-warning', icon: 'Clock' };
    case 'rejected':
      return { label: 'rejected', color: 'text-error', icon: 'XCircle' };
    default:
      return { label: 'draft', color: 'text-muted-foreground', icon: 'Edit' };
  }
}

const PlanningControls = ({
  salesmen = [],
  territories = [],
  stats = {},
  lastSavedAt = null,
  saving = false,
  onBulkAssign,
  onOptimize,
  onExport,
  onSave,
  onSubmitApproval,
  planningStatus,
  className = '',
}) => {
  const [bulkAssignMode, setBulkAssignMode] = useState(false);
  const [selectedSalesman, setSelectedSalesman] = useState('');
  const [selectedTerritories, setSelectedTerritories] = useState([]);
  const [optimizationSettings, setOptimizationSettings] = useState({
    prioritizeDistance: true,
    balanceWorkload: true,
    respectCapacity: true,
  });

  const statusMeta = getStatusMeta(planningStatus);

  const salesmanOptions = salesmen.map((salesman) => ({
    value: salesman.id,
    label: `${salesman.name} (${salesman.assignedTerritories}/${salesman.maxTerritories})`,
  }));

  const territoryOptions = useMemo(
    () =>
      territories.map((territory) => ({
        value: territory.id,
        label: `${territory.name}${territory.assignedSalesman ? ' • ανατεθειμένη' : ''}`,
      })),
    [territories]
  );

  const exportOptions = [
    { value: 'pdf', label: 'PDF Report', icon: 'FileText' },
    { value: 'excel', label: 'Excel Spreadsheet', icon: 'FileSpreadsheet' },
    { value: 'csv', label: 'CSV Data', icon: 'Database' },
    { value: 'map', label: 'Map Export', icon: 'Map' },
  ];

  const handleBulkAssignClick = async () => {
    if (!selectedSalesman || selectedTerritories.length === 0) {
      return;
    }

    await onBulkAssign?.(selectedSalesman, selectedTerritories);
    setBulkAssignMode(false);
    setSelectedSalesman('');
    setSelectedTerritories([]);
  };

  const toggleTerritory = (territoryId) => {
    setSelectedTerritories((prev) =>
      prev.includes(territoryId)
        ? prev.filter((item) => item !== territoryId)
        : [...prev, territoryId]
    );
  };

  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Έλεγχοι Σχεδιασμού</h3>
          <div className="flex items-center space-x-2">
            <Icon name={statusMeta.icon} size={16} className={statusMeta.color} />
            <span className={`text-sm font-medium capitalize ${statusMeta.color}`}>
              {statusMeta.label}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Γρήγορες Ενέργειες</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="justify-start" onClick={() => setBulkAssignMode((prev) => !prev)}>
              <Icon name="Users" size={16} />
              Μαζική Ανάθεση
            </Button>

            <Button variant="outline" className="justify-start" onClick={() => onOptimize?.(optimizationSettings)}>
              <Icon name="Zap" size={16} />
              Αυτόματη Βελτιστοποίηση
            </Button>

            <Button variant="outline" className="justify-start" onClick={() => onExport?.('csv')}>
              <Icon name="Copy" size={16} />
              Εξαγωγή CSV
            </Button>

            <Button
              variant="outline"
              className="justify-start"
              onClick={() => {
                setSelectedSalesman('');
                setSelectedTerritories([]);
              }}
            >
              <Icon name="RotateCcw" size={16} />
              Καθαρισμός
            </Button>
          </div>
        </div>

        {bulkAssignMode && (
          <div className="p-4 bg-muted/50 rounded-lg border border-border">
            <h5 className="text-sm font-medium text-foreground mb-3">Μαζική Ανάθεση Περιοχών</h5>

            <div className="space-y-3">
              <Select
                label="Επιλογή Πωλητή"
                options={salesmanOptions}
                value={selectedSalesman}
                onChange={setSelectedSalesman}
                placeholder="Διαλέξτε πωλητή..."
              />

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Περιοχές ({selectedTerritories.length})
                </label>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {territoryOptions.map((territory) => (
                    <label
                      key={territory.value}
                      className="flex items-center space-x-2 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTerritories.includes(territory.value)}
                        onChange={() => toggleTerritory(territory.value)}
                        className="rounded border-border"
                      />
                      <span className="text-sm text-foreground">{territory.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkAssignClick}
                  disabled={!selectedSalesman || selectedTerritories.length === 0 || saving}
                >
                  Ανάθεση Επιλεγμένων
                </Button>
                <Button variant="outline" size="sm" onClick={() => setBulkAssignMode(false)}>
                  Ακύρωση
                </Button>
              </div>
            </div>
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Ρυθμίσεις Βελτιστοποίησης</h4>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={optimizationSettings.prioritizeDistance}
                onChange={(e) =>
                  setOptimizationSettings((prev) => ({
                    ...prev,
                    prioritizeDistance: e.target.checked,
                  }))
                }
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Ελαχιστοποίηση απόστασης μετακίνησης</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={optimizationSettings.balanceWorkload}
                onChange={(e) =>
                  setOptimizationSettings((prev) => ({
                    ...prev,
                    balanceWorkload: e.target.checked,
                  }))
                }
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Ισορροπία φόρτου εργασίας</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={optimizationSettings.respectCapacity}
                onChange={(e) =>
                  setOptimizationSettings((prev) => ({
                    ...prev,
                    respectCapacity: e.target.checked,
                  }))
                }
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Τήρηση ορίων χωρητικότητας</span>
            </label>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Εξαγωγή και Αναφορές</h4>
          <div className="grid grid-cols-2 gap-2">
            {exportOptions.map((option) => (
              <Button
                key={option.value}
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => onExport?.(option.value)}
              >
                <Icon name={option.icon} size={14} />
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Σύνοψη Σχεδιασμού</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-muted/50 rounded-md">
              <div className="text-lg font-semibold text-foreground">{stats.territoryCount || 0}</div>
              <div className="text-xs text-muted-foreground">Περιοχές</div>
            </div>

            <div className="text-center p-2 bg-muted/50 rounded-md">
              <div className="text-lg font-semibold text-foreground">{stats.salesmanCount || 0}</div>
              <div className="text-xs text-muted-foreground">Πωλητές</div>
            </div>

            <div className="text-center p-2 bg-muted/50 rounded-md">
              <div className="text-lg font-semibold text-success">{stats.assignedCount || 0}</div>
              <div className="text-xs text-muted-foreground">Ανατεθειμένα</div>
            </div>

            <div className="text-center p-2 bg-muted/50 rounded-md">
              <div className="text-lg font-semibold text-warning">{stats.conflictsCount || 0}</div>
              <div className="text-xs text-muted-foreground">Συγκρούσεις</div>
            </div>
          </div>
          <div className="mt-3 rounded-md bg-primary/5 border border-primary/15 p-3">
            <div className="text-xs text-muted-foreground">Συνολικές προγραμματισμένες επισκέψεις</div>
            <div className="text-lg font-semibold text-foreground">{stats.totalPlannedVisits || 0}</div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex flex-col space-y-2">
          <div className="flex space-x-2">
            <Button variant="outline" className="flex-1" onClick={onSave} disabled={saving}>
              <Icon name="Save" size={16} />
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση Πρόχειρου'}
            </Button>
            <Button variant="default" className="flex-1" onClick={onSubmitApproval} disabled={saving}>
              <Icon name="Send" size={16} />
              Υποβολή για Έγκριση
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Τελευταία αποθήκευση: {lastSavedAt ? lastSavedAt.toLocaleTimeString('el-GR') : 'Δεν υπάρχει ακόμη'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanningControls;
