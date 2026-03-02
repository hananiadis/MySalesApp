import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const AnalyticsFilters = ({ onFiltersChange }) => {
  const [filters, setFilters] = useState({
    dateRange: 'last7days',
    territory: 'all',
    salesman: 'all',
    customerSegment: 'all'
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7days', label: 'Last 7 Days' },
    { value: 'last30days', label: 'Last 30 Days' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'thisQuarter', label: 'This Quarter' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const territoryOptions = [
    { value: 'all', label: 'All Territories' },
    { value: 'downtown', label: 'Downtown District' },
    { value: 'north', label: 'North Suburbs' },
    { value: 'east', label: 'East Commercial' },
    { value: 'west', label: 'West Industrial' },
    { value: 'south', label: 'South Residential' }
  ];

  const salesmanOptions = [
    { value: 'all', label: 'All Salesmen' },
    { value: 'michael', label: 'Michael Rodriguez' },
    { value: 'sarah', label: 'Sarah Chen' },
    { value: 'david', label: 'David Thompson' },
    { value: 'lisa', label: 'Lisa Johnson' },
    { value: 'robert', label: 'Robert Kim' }
  ];

  const customerSegmentOptions = [
    { value: 'all', label: 'All Segments' },
    { value: 'enterprise', label: 'Enterprise' },
    { value: 'smb', label: 'Small & Medium Business' },
    { value: 'startup', label: 'Startups' },
    { value: 'government', label: 'Government' },
    { value: 'nonprofit', label: 'Non-Profit' }
  ];

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  const resetFilters = () => {
    const defaultFilters = {
      dateRange: 'last7days',
      territory: 'all',
      salesman: 'all',
      customerSegment: 'all'
    };
    setFilters(defaultFilters);
    onFiltersChange?.(defaultFilters);
  };

  const getActiveFiltersCount = () => {
    return Object.values(filters)?.filter(value => value !== 'all' && value !== 'last7days')?.length;
  };

  const exportData = (format) => {
    // Mock export functionality
    console.log(`Exporting data in ${format} format with filters:`, filters);
    // In real implementation, this would trigger actual export
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        {/* Primary Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select
            options={dateRangeOptions}
            value={filters?.dateRange}
            onChange={(value) => handleFilterChange('dateRange', value)}
            className="w-40"
          />
          
          <Select
            options={territoryOptions}
            value={filters?.territory}
            onChange={(value) => handleFilterChange('territory', value)}
            className="w-44"
          />

          <Button
            variant="outline"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-2"
          >
            <Icon name="Filter" size={16} />
            <span>More Filters</span>
            {getActiveFiltersCount() > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                {getActiveFiltersCount()}
              </span>
            )}
            <Icon 
              name="ChevronDown" 
              size={14} 
              className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
            />
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            onClick={resetFilters}
            className="flex items-center space-x-2"
          >
            <Icon name="RotateCcw" size={16} />
            <span>Reset</span>
          </Button>

          <div className="relative group">
            <Button
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Icon name="Download" size={16} />
              <span>Export</span>
              <Icon name="ChevronDown" size={14} />
            </Button>
            
            {/* Export Dropdown */}
            <div className="absolute top-full right-0 mt-1 w-40 bg-popover border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <button
                onClick={() => exportData('excel')}
                className="w-full flex items-center space-x-2 px-3 py-2 text-sm hover:bg-muted transition-colors duration-200 first:rounded-t-md"
              >
                <Icon name="FileSpreadsheet" size={16} />
                <span>Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => exportData('csv')}
                className="w-full flex items-center space-x-2 px-3 py-2 text-sm hover:bg-muted transition-colors duration-200"
              >
                <Icon name="FileText" size={16} />
                <span>CSV (.csv)</span>
              </button>
              <button
                onClick={() => exportData('pdf')}
                className="w-full flex items-center space-x-2 px-3 py-2 text-sm hover:bg-muted transition-colors duration-200 last:rounded-b-md"
              >
                <Icon name="FileImage" size={16} />
                <span>PDF Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Expanded Filters */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select
              label="Salesman"
              options={salesmanOptions}
              value={filters?.salesman}
              onChange={(value) => handleFilterChange('salesman', value)}
            />
            
            <Select
              label="Customer Segment"
              options={customerSegmentOptions}
              value={filters?.customerSegment}
              onChange={(value) => handleFilterChange('customerSegment', value)}
            />

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setIsExpanded(false)}
                className="w-full flex items-center justify-center space-x-2"
              >
                <Icon name="ChevronUp" size={16} />
                <span>Collapse</span>
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Active Filters Summary */}
      {getActiveFiltersCount() > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {Object.entries(filters)?.map(([key, value]) => {
              if (value === 'all' || (key === 'dateRange' && value === 'last7days')) return null;
              
              const getFilterLabel = () => {
                switch (key) {
                  case 'dateRange':
                    return dateRangeOptions?.find(opt => opt?.value === value)?.label;
                  case 'territory':
                    return territoryOptions?.find(opt => opt?.value === value)?.label;
                  case 'salesman':
                    return salesmanOptions?.find(opt => opt?.value === value)?.label;
                  case 'customerSegment':
                    return customerSegmentOptions?.find(opt => opt?.value === value)?.label;
                  default:
                    return value;
                }
              };

              return (
                <span
                  key={key}
                  className="inline-flex items-center space-x-1 px-2 py-1 bg-primary/10 text-primary text-sm rounded-md"
                >
                  <span>{getFilterLabel()}</span>
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