import React, { useState, useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';

const CustomerTable = ({ 
  customers, 
  selectedCustomers, 
  onCustomerSelect, 
  onSelectAll, 
  onCustomerClick, 
  sortConfig, 
  onSort 
}) => {
  const [hoveredRow, setHoveredRow] = useState(null);

  const getSortIcon = (column) => {
    if (sortConfig?.key !== column) return 'ArrowUpDown';
    return sortConfig?.direction === 'asc' ? 'ArrowUp' : 'ArrowDown';
  };

  const getPriorityBadge = (priority) => {
    const configs = {
      high: { color: 'bg-error text-error-foreground', label: 'High' },
      medium: { color: 'bg-warning text-warning-foreground', label: 'Medium' },
      low: { color: 'bg-muted text-muted-foreground', label: 'Low' }
    };
    
    const config = configs?.[priority] || configs?.low;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config?.color}`}>
        {config?.label}
      </span>
    );
  };

  const getComplianceStatus = (compliance) => {
    if (compliance >= 90) return { color: 'text-success', icon: 'CheckCircle', label: 'Compliant' };
    if (compliance >= 70) return { color: 'text-warning', icon: 'AlertTriangle', label: 'At Risk' };
    return { color: 'text-error', icon: 'XCircle', label: 'Non-Compliant' };
  };

  const formatLastVisit = (date) => {
    const now = new Date();
    const visitDate = new Date(date);
    const diffDays = Math.floor((now - visitDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return visitDate?.toLocaleDateString();
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="w-12 p-4">
                <Checkbox
                  checked={selectedCustomers?.length === customers?.length && customers?.length > 0}
                  onChange={onSelectAll}
                  indeterminate={selectedCustomers?.length > 0 && selectedCustomers?.length < customers?.length}
                />
              </th>
              {[
                { key: 'name', label: 'Customer' },
                { key: 'territory', label: 'Territory' },
                { key: 'lastVisit', label: 'Last Visit' },
                { key: 'compliance', label: 'Compliance' },
                { key: 'priority', label: 'Priority' },
                { key: 'actions', label: 'Actions', sortable: false }
              ]?.map((column) => (
                <th key={column?.key} className="text-left p-4">
                  {column?.sortable !== false ? (
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-semibold text-muted-foreground hover:text-foreground"
                      onClick={() => onSort(column?.key)}
                    >
                      <span>{column?.label}</span>
                      <Icon 
                        name={getSortIcon(column?.key)} 
                        size={14} 
                        className="ml-1" 
                      />
                    </Button>
                  ) : (
                    <span className="font-semibold text-muted-foreground">{column?.label}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers?.map((customer) => {
              const isSelected = selectedCustomers?.includes(customer?.id);
              const complianceStatus = getComplianceStatus(customer?.compliance);
              
              return (
                <tr
                  key={customer?.id}
                  className={`border-b border-border hover:bg-muted/30 transition-colors cursor-pointer ${
                    isSelected ? 'bg-primary/5' : ''
                  }`}
                  onMouseEnter={() => setHoveredRow(customer?.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  onClick={() => onCustomerClick(customer)}
                >
                  <td className="p-4" onClick={(e) => e?.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onCustomerSelect(customer?.id)}
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <Image
                        src={customer?.avatar}
                        alt={customer?.avatarAlt}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-medium text-foreground">{customer?.name}</div>
                        <div className="text-sm text-muted-foreground">{customer?.company}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <Icon name="MapPin" size={14} className="text-primary" />
                      <span className="text-sm">{customer?.territory}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-foreground">
                      {formatLastVisit(customer?.lastVisit)}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <Icon 
                        name={complianceStatus?.icon} 
                        size={16} 
                        className={complianceStatus?.color} 
                      />
                      <span className="text-sm">{customer?.compliance}%</span>
                    </div>
                  </td>
                  <td className="p-4">
                    {getPriorityBadge(customer?.priority)}
                  </td>
                  <td className="p-4" onClick={(e) => e?.stopPropagation()}>
                    <div className="flex items-center space-x-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Icon name="Edit" size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Icon name="Calendar" size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Icon name="MoreHorizontal" size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Mobile Card Layout */}
      <div className="lg:hidden space-y-3 p-4">
        {customers?.map((customer) => {
          const isSelected = selectedCustomers?.includes(customer?.id);
          const complianceStatus = getComplianceStatus(customer?.compliance);
          
          return (
            <div
              key={customer?.id}
              className={`p-4 border border-border rounded-lg transition-colors ${
                isSelected ? 'bg-primary/5 border-primary/20' : 'bg-card hover:bg-muted/30'
              }`}
              onClick={() => onCustomerClick(customer)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3 flex-1">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => onCustomerSelect(customer?.id)}
                    onClick={(e) => e?.stopPropagation()}
                  />
                  <Image
                    src={customer?.avatar}
                    alt={customer?.avatarAlt}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">{customer?.name}</div>
                    <div className="text-sm text-muted-foreground truncate">{customer?.company}</div>
                  </div>
                </div>
                {getPriorityBadge(customer?.priority)}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center space-x-2">
                  <Icon name="MapPin" size={14} className="text-primary" />
                  <span className="truncate">{customer?.territory}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Icon name={complianceStatus?.icon} size={14} className={complianceStatus?.color} />
                  <span>{customer?.compliance}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Last visit: {formatLastVisit(customer?.lastVisit)}
                </div>
                <div className="flex items-center space-x-1" onClick={(e) => e?.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Icon name="Edit" size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Icon name="Calendar" size={14} />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CustomerTable;