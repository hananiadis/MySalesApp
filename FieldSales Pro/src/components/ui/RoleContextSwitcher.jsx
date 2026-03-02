import React, { useState, useEffect } from 'react';
import Icon from '../AppIcon';
import Button from './Button';

const RoleContextSwitcher = ({ className = '' }) => {
  const [currentRole, setCurrentRole] = useState('manager');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const roles = [
    {
      id: 'manager',
      label: 'Manager View',
      icon: 'BarChart3',
      description: 'Strategic oversight and team management',
      defaultRoute: '/manager-dashboard'
    },
    {
      id: 'field',
      label: 'Field View',
      icon: 'MapPin',
      description: 'Mobile-optimized field operations',
      defaultRoute: '/my-day-mobile'
    }
  ];

  useEffect(() => {
    // Load saved role preference from localStorage
    const savedRole = localStorage.getItem('fieldSalesRole');
    if (savedRole && roles?.find(role => role?.id === savedRole)) {
      setCurrentRole(savedRole);
    }
  }, []);

  const handleRoleSwitch = (roleId) => {
    setCurrentRole(roleId);
    localStorage.setItem('fieldSalesRole', roleId);
    setIsDropdownOpen(false);
    
    // Emit custom event for role change
    window.dispatchEvent(new CustomEvent('roleContextChanged', {
      detail: { role: roleId }
    }));
  };

  const getCurrentRoleData = () => {
    return roles?.find(role => role?.id === currentRole) || roles?.[0];
  };

  const currentRoleData = getCurrentRoleData();

  return (
    <div className={`relative ${className}`}>
      {/* Desktop Role Switcher */}
      <div className="hidden md:block">
        <Button
          variant="outline"
          className="flex items-center space-x-2 px-3 py-2"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <Icon name={currentRoleData?.icon} size={16} />
          <span className="text-sm font-medium">{currentRoleData?.label}</span>
          <Icon name="ChevronDown" size={14} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </Button>
      </div>
      {/* Mobile Role Indicator */}
      <div className="md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <Icon name={currentRoleData?.icon} size={18} />
        </Button>
      </div>
      {/* Role Dropdown */}
      {isDropdownOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsDropdownOpen(false)}
          />
          
          {/* Dropdown Menu */}
          <div className="absolute top-full right-0 mt-2 w-64 bg-popover border border-border rounded-lg shadow-elevation z-50 overflow-hidden">
            <div className="p-2">
              <div className="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">
                Switch Context
              </div>
              
              {roles?.map((role) => (
                <button
                  key={role?.id}
                  onClick={() => handleRoleSwitch(role?.id)}
                  className={`w-full flex items-start space-x-3 px-3 py-3 rounded-md transition-colors duration-200 text-left ${
                    currentRole === role?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <Icon 
                    name={role?.icon} 
                    size={18} 
                    className={currentRole === role?.id ? 'text-primary-foreground' : 'text-primary'} 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{role?.label}</div>
                    <div className={`text-xs mt-1 ${
                      currentRole === role?.id ? 'text-primary-foreground/80' : 'text-muted-foreground'
                    }`}>
                      {role?.description}
                    </div>
                  </div>
                  {currentRole === role?.id && (
                    <Icon name="Check" size={16} className="text-primary-foreground flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>

            <div className="border-t border-border p-3 bg-muted/50">
              <div className="text-xs text-muted-foreground">
                Role context affects navigation emphasis and default views
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RoleContextSwitcher;