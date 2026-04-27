import React, { useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const AnalyticsFilters = ({ onFiltersChange, territoryOptions = [], salesmanOptions = [] }) => {
  const [filters, setFilters] = useState({
    dateRange: 'last7days',
    territory: 'all',
    salesman: 'all',
    customerSegment: 'all',
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const dateRangeOptions = [
    { value: 'today', label: 'Σήμερα' },
    { value: 'yesterday', label: 'Χθες' },
    { value: 'last7days', label: 'Τελευταίες 7 Ημέρες' },
    { value: 'last30days', label: 'Τελευταίες 30 Ημέρες' },
    { value: 'thisMonth', label: 'Τρέχων Μήνας' },
    { value: 'lastMonth', label: 'Προηγούμενος Μήνας' },
    { value: 'thisQuarter', label: 'Τρέχον Τρίμηνο' },
  ];

  const resolvedTerritoryOptions = useMemo(
    () => [{ value: 'all', label: 'Όλες οι Περιοχές' }, ...territoryOptions],
    [territoryOptions]
  );

  const resolvedSalesmanOptions = useMemo(
    () => [{ value: 'all', label: 'Όλοι οι Πωλητές' }, ...salesmanOptions],
    [salesmanOptions]
  );

  const customerSegmentOptions = [
    { value: 'all', label: 'Όλα τα Τμήματα' },
    { value: 'enterprise', label: 'Μεγάλες Επιχειρήσεις' },
    { value: 'smb', label: 'Μικρές & Μεσαίες Επιχειρήσεις' },
    { value: 'startup', label: 'Νεοφυείς Επιχειρήσεις' },
    { value: 'government', label: 'Δημόσιος Τομέας' },
    { value: 'nonprofit', label: 'Μη Κερδοσκοπικοί Οργανισμοί' },
  ];

  const handleFilterChange = (key, value) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    onFiltersChange?.(nextFilters);
  };

  const resetFilters = () => {
    const defaults = {
      dateRange: 'last7days',
      territory: 'all',
      salesman: 'all',
      customerSegment: 'all',
    };
    setFilters(defaults);
    onFiltersChange?.(defaults);
  };

  const getActiveFiltersCount = () =>
    Object.entries(filters).filter(([key, value]) => value !== 'all' && !(key === 'dateRange' && value === 'last7days')).length;

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            options={dateRangeOptions}
            value={filters.dateRange}
            onChange={(value) => handleFilterChange('dateRange', value)}
            className="w-40"
          />

          <Select
            options={resolvedTerritoryOptions}
            value={filters.territory}
            onChange={(value) => handleFilterChange('territory', value)}
            className="w-52"
          />

          <Button variant="outline" onClick={() => setIsExpanded((prev) => !prev)} className="flex items-center space-x-2">
            <Icon name="Filter" size={16} />
            <span>Περισσότερα Φίλτρα</span>
            {getActiveFiltersCount() > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">{getActiveFiltersCount()}</span>
            )}
            <Icon name="ChevronDown" size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" onClick={resetFilters} className="flex items-center space-x-2">
            <Icon name="RotateCcw" size={16} />
            <span>Επαναφορά</span>
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select
              label="Πωλητής"
              options={resolvedSalesmanOptions}
              value={filters.salesman}
              onChange={(value) => handleFilterChange('salesman', value)}
            />

            <Select
              label="Τμήμα Πελατών"
              options={customerSegmentOptions}
              value={filters.customerSegment}
              onChange={(value) => handleFilterChange('customerSegment', value)}
            />

            <div className="flex items-end">
              <Button variant="outline" onClick={() => setIsExpanded(false)} className="w-full flex items-center justify-center space-x-2">
                <Icon name="ChevronUp" size={16} />
                <span>Σύμπτυξη</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {getActiveFiltersCount() > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Ενεργά φίλτρα:</span>
            {Object.entries(filters).map(([key, value]) => {
              if (value === 'all' || (key === 'dateRange' && value === 'last7days')) {
                return null;
              }

              const optionsByKey = {
                dateRange: dateRangeOptions,
                territory: resolvedTerritoryOptions,
                salesman: resolvedSalesmanOptions,
                customerSegment: customerSegmentOptions,
              };
              const label = optionsByKey[key]?.find((option) => option.value === value)?.label || value;

              return (
                <span key={key} className="inline-flex items-center space-x-1 px-2 py-1 bg-primary/10 text-primary text-sm rounded-md">
                  <span>{label}</span>
                  <button
                    onClick={() => handleFilterChange(key, key === 'dateRange' ? 'last7days' : 'all')}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <Icon name="X" size={12} />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsFilters;
