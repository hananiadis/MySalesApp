import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const BulkActionsPanel = ({ 
  selectedCount, 
  onClearSelection, 
  onBulkTerritoryChange, 
  onBulkPriorityChange,
  onBulkScheduleVisit,
  onBulkExport 
}) => {
  const [showActions, setShowActions] = useState(false);
  const [bulkTerritory, setBulkTerritory] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');

  if (selectedCount === 0) return null;

  const territoryOptions = [
    { value: '', label: 'Select Territory' },
    { value: 'north', label: 'North Region' },
    { value: 'south', label: 'South Region' },
    { value: 'east', label: 'East Region' },
    { value: 'west', label: 'West Region' },
    { value: 'central', label: 'Central Region' }
  ];

  const priorityOptions = [
    { value: '', label: 'Select Priority' },
    { value: 'high', label: 'High Priority' },
    { value: 'medium', label: 'Medium Priority' },
    { value: 'low', label: 'Low Priority' }
  ];

  const handleBulkTerritoryChange = () => {
    if (bulkTerritory) {
      onBulkTerritoryChange(bulkTerritory);
      setBulkTerritory('');
      setShowActions(false);
    }
  };

  const handleBulkPriorityChange = () => {
    if (bulkPriority) {
      onBulkPriorityChange(bulkPriority);
      setBulkPriority('');
      setShowActions(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
      <div className="bg-card border border-border rounded-lg shadow-elevation p-4 min-w-[320px]">
        {/* Selection Summary */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-medium">{selectedCount}</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {selectedCount} customer{selectedCount !== 1 ? 's' : ''} selected
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClearSelection}>
            <Icon name="X" size={16} />
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowActions(!showActions)}
            iconName="Settings"
            iconPosition="left"
          >
            Bulk Actions
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkScheduleVisit}
            iconName="Calendar"
            iconPosition="left"
          >
            Schedule Visits
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkExport}
            iconName="Download"
            iconPosition="left"
          >
            Export
          </Button>
        </div>

        {/* Expanded Actions */}
        {showActions && (
          <div className="space-y-4 pt-4 border-t border-border">
            {/* Territory Assignment */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Change Territory</label>
              <div className="flex items-center space-x-2">
                <Select
                  options={territoryOptions}
                  value={bulkTerritory}
                  onChange={setBulkTerritory}
                  placeholder="Select new territory"
                  className="flex-1"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkTerritoryChange}
                  disabled={!bulkTerritory}
                >
                  Apply
                </Button>
              </div>
            </div>

            {/* Priority Assignment */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Change Priority</label>
              <div className="flex items-center space-x-2">
                <Select
                  options={priorityOptions}
                  value={bulkPriority}
                  onChange={setBulkPriority}
                  placeholder="Select new priority"
                  className="flex-1"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkPriorityChange}
                  disabled={!bulkPriority}
                >
                  Apply
                </Button>
              </div>
            </div>

            {/* Additional Actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" iconName="UserX" iconPosition="left">
                Deactivate
              </Button>
              <Button variant="outline" size="sm" iconName="Archive" iconPosition="left">
                Archive
              </Button>
            </div>
          </div>
        )}

        {/* Drag & Drop Hint */}
        <div className="mt-4 p-3 bg-muted/50 rounded-md">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <Icon name="Move" size={14} />
            <span>Tip: Drag selected customers to territory map for quick reassignment</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkActionsPanel;