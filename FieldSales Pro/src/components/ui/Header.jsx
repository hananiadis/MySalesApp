import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import Button from './Button';
import StatusIndicator from './StatusIndicator';
import RoleContextSwitcher from './RoleContextSwitcher';
import NotificationBadge from './NotificationBadge';

const Header = ({ className = '' }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigationItems = [
    {
      label: 'Ταμπλό',
      path: '/manager-dashboard',
      icon: 'BarChart3',
      tooltip: 'Παρακολούθηση ομάδας και απόδοσης σε πραγματικό χρόνο'
    },
    {
      label: 'Σχεδιασμός',
      path: '/territory-planning',
      icon: 'Map',
      tooltip: 'Εργαλεία στρατηγικού σχεδιασμού περιοχών και επισκέψεων',
      subItems: [
        { label: 'Σχεδιασμός Περιοχών', path: '/territory-planning' },
        { label: 'Προγραμματισμός Επισκέψεων', path: '/visit-scheduling' }
      ]
    },
    {
      label: 'Πελάτες',
      path: '/customer-management',
      icon: 'Users',
      tooltip: 'Βάση πελατών και διαχείριση περιοχών'
    },
    {
      label: 'Η Μέρα Μου',
      path: '/my-day-mobile',
      icon: 'Calendar',
      tooltip: 'Περιβάλλον εκτέλεσης πεδίου με προτεραιότητα στο mobile'
    },
    {
      label: 'Αναλύσεις',
      path: '/performance-analytics',
      icon: 'TrendingUp',
      tooltip: 'Εργαλεία αναφορών και ανάλυσης απόδοσης'
    }
  ];

  const isActiveRoute = (path) => {
    return location?.pathname === path || location?.pathname?.startsWith(path + '/');
  };

  const isPlanningActive = () => {
    return isActiveRoute('/territory-planning') || isActiveRoute('/visit-scheduling');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 bg-card border-b border-border ${className}`}>
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Logo Section */}
        <div className="flex items-center">
          <Link to="/manager-dashboard" className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
              <Icon name="Zap" size={20} color="white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-semibold text-foreground">FieldSales Pro</h1>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-1">
          {navigationItems?.map((item) => {
            const isActive = item?.path === '/territory-planning' || item?.path === '/visit-scheduling' 
              ? isPlanningActive() 
              : isActiveRoute(item?.path);

            if (item?.subItems) {
              return (
                <div key={item?.label} className="relative group">
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className="flex items-center space-x-2 px-3 py-2 relative"
                  >
                    <Icon name={item?.icon} size={18} />
                    <span className="font-medium">{item?.label}</span>
                    <Icon name="ChevronDown" size={14} />
                    <NotificationBadge 
                      count={item?.label === 'Σχεδιασμός' ? 3 : 0}
                      className="absolute -top-1 -right-1"
                    />
                  </Button>
                  {/* Dropdown Menu */}
                  <div className="absolute top-full left-0 mt-1 w-48 bg-popover border border-border rounded-md shadow-elevation opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    {item?.subItems?.map((subItem) => (
                      <Link
                        key={subItem?.path}
                        to={subItem?.path}
                        className={`block px-4 py-3 text-sm hover:bg-muted transition-colors duration-200 first:rounded-t-md last:rounded-b-md ${
                          isActiveRoute(subItem?.path) 
                            ? 'bg-muted text-primary font-medium' :'text-muted-foreground'
                        }`}
                      >
                        {subItem?.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <Link key={item?.path} to={item?.path} title={item?.tooltip}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className="flex items-center space-x-2 px-3 py-2 relative"
                >
                  <Icon name={item?.icon} size={18} />
                  <span className="font-medium">{item?.label}</span>
                  <NotificationBadge 
                    count={item?.label === 'Η Μέρα Μου' ? 2 : item?.label === 'Αναλύσεις' ? 1 : 0}
                    className="absolute -top-1 -right-1"
                  />
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Right Section */}
        <div className="flex items-center space-x-3">
          <StatusIndicator />
          <RoleContextSwitcher />
          
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={toggleMobileMenu}
          >
            <Icon name={isMobileMenuOpen ? "X" : "Menu"} size={20} />
          </Button>
        </div>
      </div>
      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-card border-t border-border">
          <nav className="px-4 py-2 space-y-1">
            {navigationItems?.map((item) => {
              if (item?.subItems) {
                return (
                  <div key={item?.label} className="space-y-1">
                    <div className="flex items-center space-x-3 px-3 py-2 text-muted-foreground font-medium text-sm">
                      <Icon name={item?.icon} size={18} />
                      <span>{item?.label}</span>
                    </div>
                    {item?.subItems?.map((subItem) => (
                      <Link
                        key={subItem?.path}
                        to={subItem?.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center space-x-3 px-6 py-3 rounded-md transition-colors duration-200 ${
                          isActiveRoute(subItem?.path)
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <span className="font-medium">{subItem?.label}</span>
                        <NotificationBadge 
                          count={subItem?.path === '/territory-planning' ? 2 : subItem?.path === '/visit-scheduling' ? 1 : 0}
                        />
                      </Link>
                    ))}
                  </div>
                );
              }

              const isActive = isActiveRoute(item?.path);
              return (
                <Link
                  key={item?.path}
                  to={item?.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-3 rounded-md transition-colors duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon name={item?.icon} size={18} />
                    <span className="font-medium">{item?.label}</span>
                  </div>
                  <NotificationBadge 
                    count={item?.label === 'Η Μέρα Μου' ? 2 : item?.label === 'Αναλύσεις' ? 1 : 0}
                  />
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;