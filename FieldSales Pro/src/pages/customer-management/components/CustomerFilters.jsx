import React from 'react';
import Icon from '../../../components/AppIcon';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';

const CustomerFilters = ({ 
  searchTerm, 
  onSearchChange, 
  territoryFilter, 
  territoryOptions,
  onTerritoryChange, 
  priorityFilter, 
  onPriorityChange, 
  complianceFilter, 
  onComplianceChange,
  onClearFilters,
  resultCount 
}) => {
  const defaultTerritoryOptions = [
    { value: 'all', label: 'Όλες οι Περιοχές' },
    { value: 'north', label: 'Βόρεια Ζώνη' },
    { value: 'south', label: 'Νότια Ζώνη' },
    { value: 'east', label: 'Ανατολική Ζώνη' },
    { value: 'west', label: 'Δυτική Ζώνη' },
    { value: 'central', label: 'Κεντρική Ζώνη' }
  ];

  const priorityOptions = [
    { value: 'all', label: 'Όλες οι Προτεραιότητες' },
    { value: 'high', label: 'Υψηλή Προτεραιότητα' },
    { value: 'medium', label: 'Μεσαία Προτεραιότητα' },
    { value: 'low', label: 'Χαμηλή Προτεραιότητα' }
  ];

  const complianceOptions = [
    { value: 'all', label: 'Όλη η Συμμόρφωση' },
    { value: 'compliant', label: 'Συμμορφωμένοι (90%+)' },
    { value: 'at-risk', label: 'Σε Κίνδυνο (70-89%)' },
    { value: 'non-compliant', label: 'Μη Συμμορφωμένοι (<70%)' }
  ];

  const hasActiveFilters = territoryFilter !== 'all' || priorityFilter !== 'all' || complianceFilter !== 'all' || searchTerm;

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      {/* Search and Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
        <div className="flex-1 max-w-md">
          <Input
            type="search"
            placeholder="Αναζήτηση πελατών με όνομα, εταιρεία ή περιοχή..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e?.target?.value)}
            className="w-full"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" iconName="Download" iconPosition="left">
            Εξαγωγή
          </Button>
          <Button variant="default" iconName="Plus" iconPosition="left">
            Προσθήκη Πελάτη
          </Button>
        </div>
      </div>
      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Select
          label="Περιοχή"
          options={territoryOptions?.length ? territoryOptions : defaultTerritoryOptions}
          value={territoryFilter}
          onChange={onTerritoryChange}
          className="w-full"
        />

        <Select
          label="Επίπεδο Προτεραιότητας"
          options={priorityOptions}
          value={priorityFilter}
          onChange={onPriorityChange}
          className="w-full"
        />

        <Select
          label="Συμμόρφωση Επισκέψεων"
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
              Καθαρισμός Φίλτρων
            </Button>
          )}
        </div>
      </div>
      {/* Results Summary */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <span>
            Εμφάνιση <span className="font-medium text-foreground">{resultCount}</span> πελατών
          </span>
          {hasActiveFilters && (
            <div className="flex items-center space-x-1">
              <Icon name="Filter" size={14} />
              <span>Ενεργά φίλτρα</span>
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