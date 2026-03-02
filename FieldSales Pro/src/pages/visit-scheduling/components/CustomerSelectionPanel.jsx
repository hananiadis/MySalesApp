import React, { useState, useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';

const CustomerSelectionPanel = ({ 
  customers, 
  selectedCustomers, 
  onCustomerSelect, 
  onBulkSchedule,
  territories,
  className = '' 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTerritory, setSelectedTerritory] = useState('all');
  const [showPriorityOnly, setShowPriorityOnly] = useState(false);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  const territoryOptions = [
    { value: 'all', label: 'All Territories' },
    ...territories?.map(territory => ({
      value: territory?.id,
      label: territory?.name
    }))
  ];

  const filteredCustomers = useMemo(() => {
    return customers?.filter(customer => {
      const matchesSearch = customer?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
                           customer?.company?.toLowerCase()?.includes(searchTerm?.toLowerCase());
      const matchesTerritory = selectedTerritory === 'all' || customer?.territoryId === selectedTerritory;
      const matchesPriority = !showPriorityOnly || customer?.priority === 'high';
      const matchesOverdue = !showOverdueOnly || customer?.isOverdue;
      
      return matchesSearch && matchesTerritory && matchesPriority && matchesOverdue;
    });
  }, [customers, searchTerm, selectedTerritory, showPriorityOnly, showOverdueOnly]);

  const selectedCount = selectedCustomers?.length;

  const handleSelectAll = () => {
    const allIds = filteredCustomers?.map(customer => customer?.id);
    onCustomerSelect(allIds);
  };

  const handleClearSelection = () => {
    onCustomerSelect([]);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-error';
      case 'medium': return 'text-warning';
      default: return 'text-muted-foreground';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high': return 'AlertTriangle';
      case 'medium': return 'Clock';
      default: return 'Circle';
    }
  };

  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Customer Selection</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              {selectedCount} selected
            </span>
            {selectedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkSchedule}
                iconName="Calendar"
                iconPosition="left"
              >
                Schedule Selected
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          <Input
            type="search"
            placeholder="Search customers or companies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e?.target?.value)}
            className="w-full"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Select
              label="Territory"
              options={territoryOptions}
              value={selectedTerritory}
              onChange={setSelectedTerritory}
            />
            
            <div className="space-y-2">
              <Checkbox
                label="Priority customers only"
                checked={showPriorityOnly}
                onChange={(e) => setShowPriorityOnly(e?.target?.checked)}
              />
              <Checkbox
                label="Overdue visits only"
                checked={showOverdueOnly}
                onChange={(e) => setShowOverdueOnly(e?.target?.checked)}
              />
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {filteredCustomers?.length > 0 && (
          <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              iconName="CheckSquare"
              iconPosition="left"
            >
              Select All ({filteredCustomers?.length})
            </Button>
            {selectedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                iconName="X"
                iconPosition="left"
              >
                Clear Selection
              </Button>
            )}
          </div>
        )}
      </div>
      {/* Customer List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredCustomers?.length === 0 ? (
          <div className="p-8 text-center">
            <Icon name="Users" size={48} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No customers match your filters</p>
          </div>
        ) : (
          <div className="p-2">
            {filteredCustomers?.map((customer) => (
              <div
                key={customer?.id}
                className={`p-3 rounded-md border-2 border-transparent cursor-pointer transition-all duration-200 hover:bg-muted ${
                  selectedCustomers?.includes(customer?.id) 
                    ? 'bg-primary/10 border-primary' :''
                }`}
                onClick={() => {
                  const newSelection = selectedCustomers?.includes(customer?.id)
                    ? selectedCustomers?.filter(id => id !== customer?.id)
                    : [...selectedCustomers, customer?.id];
                  onCustomerSelect(newSelection);
                }}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      selectedCustomers?.includes(customer?.id)
                        ? 'bg-primary border-primary' :'border-border'
                    }`}>
                      {selectedCustomers?.includes(customer?.id) && (
                        <Icon name="Check" size={12} className="text-primary-foreground" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-foreground truncate">
                        {customer?.name}
                      </h4>
                      <Icon 
                        name={getPriorityIcon(customer?.priority)} 
                        size={14} 
                        className={getPriorityColor(customer?.priority)} 
                      />
                      {customer?.isOverdue && (
                        <span className="px-2 py-0.5 text-xs bg-error/10 text-error rounded-full">
                          Overdue
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground truncate mb-1">
                      {customer?.company}
                    </p>
                    
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span className="flex items-center space-x-1">
                        <Icon name="MapPin" size={12} />
                        <span>{customer?.location}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Icon name="Calendar" size={12} />
                        <span>Last: {customer?.lastVisit}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerSelectionPanel;