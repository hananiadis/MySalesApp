import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';


const PlanningControls = ({ 
  onBulkAssign, 
  onOptimize, 
  onExport, 
  onSave,
  onSubmitApproval,
  planningStatus,
  className = '' 
}) => {
  const [bulkAssignMode, setBulkAssignMode] = useState(false);
  const [selectedSalesman, setSelectedSalesman] = useState('');
  const [selectedTerritories, setSelectedTerritories] = useState([]);
  const [optimizationSettings, setOptimizationSettings] = useState({
    prioritizeDistance: true,
    balanceWorkload: true,
    respectCapacity: true
  });

  const salesmanOptions = [
    { value: 'sm001', label: 'John Smith (2/5 territories)' },
    { value: 'sm002', label: 'Sarah Johnson (3/4 territories)' },
    { value: 'sm003', label: 'Mike Chen (1/6 territories)' },
    { value: 'sm004', label: 'Lisa Rodriguez (4/5 territories)' },
    { value: 'sm005', label: 'David Wilson (0/4 territories)' }
  ];

  const exportOptions = [
    { value: 'pdf', label: 'PDF Report', icon: 'FileText' },
    { value: 'excel', label: 'Excel Spreadsheet', icon: 'FileSpreadsheet' },
    { value: 'csv', label: 'CSV Data', icon: 'Database' },
    { value: 'map', label: 'Map Export', icon: 'Map' }
  ];

  const handleBulkAssign = () => {
    if (selectedSalesman && selectedTerritories?.length > 0) {
      onBulkAssign(selectedSalesman, selectedTerritories);
      setBulkAssignMode(false);
      setSelectedTerritories([]);
      setSelectedSalesman('');
    }
  };

  const handleOptimize = () => {
    onOptimize(optimizationSettings);
  };

  const getStatusColor = () => {
    switch (planningStatus) {
      case 'draft': return 'text-muted-foreground';
      case 'pending': return 'text-warning';
      case 'approved': return 'text-success';
      case 'rejected': return 'text-error';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = () => {
    switch (planningStatus) {
      case 'draft': return 'Edit';
      case 'pending': return 'Clock';
      case 'approved': return 'CheckCircle';
      case 'rejected': return 'XCircle';
      default: return 'FileText';
    }
  };

  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Planning Controls</h3>
          <div className="flex items-center space-x-2">
            <Icon name={getStatusIcon()} size={16} className={getStatusColor()} />
            <span className={`text-sm font-medium capitalize ${getStatusColor()}`}>
              {planningStatus}
            </span>
          </div>
        </div>
      </div>
      {/* Quick Actions */}
      <div className="p-4 space-y-4">
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Quick Actions</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => setBulkAssignMode(!bulkAssignMode)}
            >
              <Icon name="Users" size={16} />
              Bulk Assign
            </Button>
            
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={handleOptimize}
            >
              <Icon name="Zap" size={16} />
              Auto Optimize
            </Button>
            
            <Button 
              variant="outline" 
              className="justify-start"
            >
              <Icon name="Copy" size={16} />
              Copy Previous
            </Button>
            
            <Button 
              variant="outline" 
              className="justify-start"
            >
              <Icon name="RotateCcw" size={16} />
              Reset All
            </Button>
          </div>
        </div>

        {/* Bulk Assignment Panel */}
        {bulkAssignMode && (
          <div className="p-4 bg-muted/50 rounded-lg border border-border">
            <h5 className="text-sm font-medium text-foreground mb-3">Bulk Territory Assignment</h5>
            
            <div className="space-y-3">
              <Select
                label="Select Salesman"
                options={salesmanOptions}
                value={selectedSalesman}
                onChange={setSelectedSalesman}
                placeholder="Choose salesman..."
              />
              
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Selected Territories ({selectedTerritories?.length})
                </label>
                <div className="text-xs text-muted-foreground mb-2">
                  Click territories on the map to select them for bulk assignment
                </div>
                {selectedTerritories?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedTerritories?.map((territoryId) => (
                      <span
                        key={territoryId}
                        className="inline-flex items-center space-x-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md"
                      >
                        <span>Territory {territoryId}</span>
                        <button
                          onClick={() => setSelectedTerritories(prev => prev?.filter(id => id !== territoryId))}
                          className="hover:text-primary/70"
                        >
                          <Icon name="X" size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleBulkAssign}
                  disabled={!selectedSalesman || selectedTerritories?.length === 0}
                >
                  Assign Selected
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setBulkAssignMode(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Optimization Settings */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Optimization Settings</h4>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={optimizationSettings?.prioritizeDistance}
                onChange={(e) => setOptimizationSettings(prev => ({
                  ...prev,
                  prioritizeDistance: e?.target?.checked
                }))}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Minimize travel distance</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={optimizationSettings?.balanceWorkload}
                onChange={(e) => setOptimizationSettings(prev => ({
                  ...prev,
                  balanceWorkload: e?.target?.checked
                }))}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Balance workload evenly</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={optimizationSettings?.respectCapacity}
                onChange={(e) => setOptimizationSettings(prev => ({
                  ...prev,
                  respectCapacity: e?.target?.checked
                }))}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Respect capacity limits</span>
            </label>
          </div>
        </div>

        {/* Export Options */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Export & Reports</h4>
          <div className="grid grid-cols-2 gap-2">
            {exportOptions?.map((option) => (
              <Button
                key={option?.value}
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => onExport(option?.value)}
              >
                <Icon name={option?.icon} size={14} />
                {option?.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Planning Statistics */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Planning Summary</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-muted/50 rounded-md">
              <div className="text-lg font-semibold text-foreground">12</div>
              <div className="text-xs text-muted-foreground">Territories</div>
            </div>
            
            <div className="text-center p-2 bg-muted/50 rounded-md">
              <div className="text-lg font-semibold text-foreground">5</div>
              <div className="text-xs text-muted-foreground">Salesmen</div>
            </div>
            
            <div className="text-center p-2 bg-muted/50 rounded-md">
              <div className="text-lg font-semibold text-success">8</div>
              <div className="text-xs text-muted-foreground">Assigned</div>
            </div>
            
            <div className="text-center p-2 bg-muted/50 rounded-md">
              <div className="text-lg font-semibold text-warning">2</div>
              <div className="text-xs text-muted-foreground">Conflicts</div>
            </div>
          </div>
        </div>
      </div>
      {/* Action Buttons */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex flex-col space-y-2">
          <div className="flex space-x-2">
            <Button variant="outline" className="flex-1" onClick={onSave}>
              <Icon name="Save" size={16} />
              Save Draft
            </Button>
            <Button variant="default" className="flex-1" onClick={onSubmitApproval}>
              <Icon name="Send" size={16} />
              Submit for Approval
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground text-center">
            Last saved: {new Date()?.toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanningControls;