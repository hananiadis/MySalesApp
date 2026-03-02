import React from 'react';
import Icon from '../../../components/AppIcon';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';

const CustomerFilters = ({ 
  searchTerm, 
  onSearchChange, 
  territoryFilter, 
  onTerritoryChange, 
  priorityFilter, 
  onPriorityChange, 
  complianceFilter, 
  onComplianceChange,
  onClearFilters,
  resultCount 
}) => {
  const territoryOptions = [
    { value: 'all', label: 'All Territories' },
    { value: 'north', label: 'North Region' },
    { value: 'south', label: 'South Region' },
    { value: 'east', label: 'East Region' },
    { value: 'west', label: 'West Region' },
    { value: 'central', label: 'Central Region' }
  ];

  const priorityOptions = [
    { value: 'all', label: 'All Priorities' },
    { value: 'high', label: 'High Priority' },
    { value: 'medium', label: 'Medium Priority' },
    { value: 'low', label: 'Low Priority' }
  ];

  const complianceOptions = [
    { value: 'all', label: 'All Compliance' },
    { value: 'compliant', label: 'Compliant (90%+)' },
    { value: 'at-risk', label: 'At Risk (70-89%)' },
    { value: 'non-compliant', label: 'Non-Compliant (<70%)' }
  ];

  const hasActiveFilters = territoryFilter !== 'all' || priorityFilter !== 'all' || complianceFilter !== 'all' || searchTerm;

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      {/* Search and Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
        <div className="flex-1 max-w-md">
          <Input
            type="search"
            placeholder="Search customers by name, company, or territory..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e?.target?.value)}
            className="w-full"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" iconName="Download" iconPosition="left">
            Export
          </Button>
          <Button variant="default" iconName="Plus" iconPosition="left">
            Add Customer
          </Button>
        </div>
      </div>
      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Select
          label="Territory"
          options={territoryOptions}
          value={territoryFilter}
          onChange={onTerritoryChange}
          className="w-full"
        />

        <Select
          label="Priority Level"
          options={priorityOptions}
          value={priorityFilter}
          onChange={onPriorityChange}
          className="w-full"
        />

        <Select
          label="Visit Compliance"
          options={complianceOptions}
          value={complianceFilter}
          onChange={onComplianceChange}
          className="w-full"
        />

        <div className="flex items-end">
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={onClearFilters}
              iconName="X"
              iconPosition="left"
              className="w-full md:w-auto"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>
      {/* Results Summary */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <span>
            Showing <span className="font-medium text-foreground">{resultCount}</span> customers
          </span>
          {hasActiveFilters && (
            <div className="flex items-center space-x-1">
              <Icon name="Filter" size={14} />
              <span>Filters active</span>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="hidden lg:flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            <span className="text-muted-foreground">Compliant: 156</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-warning rounded-full"></div>
            <span className="text-muted-foreground">At Risk: 43</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-error rounded-full"></div>
            <span className="text-muted-foreground">Non-Compliant: 18</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerFilters;