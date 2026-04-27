import React, { useState, useEffect } from 'react';
import Icon from '../AppIcon';

const StatusIndicator = ({ className = '' }) => {
  const [status, setStatus] = useState({
    connectivity: 'online',
    fieldTeamActive: 12,
    visitCompletionRate: 78,
    lastSync: new Date()
  });

  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      setStatus(prev => ({
        ...prev,
        fieldTeamActive: Math.floor(Math.random() * 5) + 10,
        visitCompletionRate: Math.floor(Math.random() * 20) + 70,
        lastSync: new Date()
      }));
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (status?.connectivity === 'offline') return 'text-error';
    if (status?.visitCompletionRate < 60) return 'text-warning';
    return 'text-success';
  };

  const getStatusIcon = () => {
    if (status?.connectivity === 'offline') return 'WifiOff';
    if (status?.visitCompletionRate < 60) return 'AlertTriangle';
    return 'CheckCircle';
  };

  const getConnectivityLabel = () => {
    return status?.connectivity === 'offline' ? 'εκτός σύνδεσης' : 'σε σύνδεση';
  };

  return (
    <div className={`relative ${className}`}>
      {/* Desktop Status Indicator */}
      <div 
        className="hidden md:flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-muted cursor-pointer transition-colors duration-200"
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        <div className={`w-2 h-2 rounded-full ${getStatusColor()?.replace('text-', 'bg-')} animate-pulse`} />
        <span className="text-sm font-medium text-muted-foreground">
          {status?.fieldTeamActive} Ενεργοί
        </span>
        <Icon name="Info" size={14} className="text-muted-foreground" />
      </div>
      {/* Mobile Status Indicator */}
      <div 
        className="md:hidden flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted cursor-pointer transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Icon name={getStatusIcon()} size={16} className={getStatusColor()} />
      </div>
      {/* Expanded Status Panel */}
      {isExpanded && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-popover border border-border rounded-lg shadow-elevation z-50 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Κατάσταση Συστήματος</h3>
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${getStatusColor()?.replace('text-', 'bg-')}`} />
                <span className="text-xs text-muted-foreground capitalize">
                  {getConnectivityLabel()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Ομάδα Πεδίου</div>
                <div className="flex items-center space-x-1">
                  <Icon name="Users" size={14} className="text-primary" />
                  <span className="text-sm font-medium">{status?.fieldTeamActive} Ενεργοί</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Ποσοστό Ολοκλήρωσης</div>
                <div className="flex items-center space-x-1">
                  <Icon name="Target" size={14} className="text-accent" />
                  <span className="text-sm font-medium">{status?.visitCompletionRate}%</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Τελευταίος συγχρονισμός</span>
                <span>{status?.lastSync?.toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Επισκέψεις</div>
                <div className="text-sm font-medium text-foreground">24</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Σε εκκρεμότητα</div>
                <div className="text-sm font-medium text-warning">6</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Συγκρούσεις</div>
                <div className="text-sm font-medium text-error">2</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusIndicator;