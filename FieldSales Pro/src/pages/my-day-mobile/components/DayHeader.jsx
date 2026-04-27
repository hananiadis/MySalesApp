import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const DayHeader = ({ currentDate, stats, onSyncData, isOnline, lastSync }) => {
  const formatDate = (date) => {
    return date?.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatSyncTime = (date) => {
    return date?.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="bg-card border-b border-border p-4 sticky top-16 z-40">
      {/* Date and Sync Status */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Η Μέρα Μου</h1>
          <p className="text-sm text-muted-foreground">{formatDate(currentDate)}</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`flex items-center space-x-1 ${isOnline ? 'text-success' : 'text-error'}`}>
            <Icon name={isOnline ? "Wifi" : "WifiOff"} size={16} />
            <span className="text-xs font-medium">{isOnline ? 'Σε σύνδεση' : 'Εκτός σύνδεσης'}</span>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onSyncData}
            disabled={!isOnline}
          >
            <Icon name="RefreshCw" size={18} />
          </Button>
        </div>
      </div>
      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="text-center">
          <div className="text-lg font-semibold text-foreground">{stats?.total}</div>
          <div className="text-xs text-muted-foreground">Σύνολο</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-success">{stats?.completed}</div>
          <div className="text-xs text-muted-foreground">Ολοκληρωμένα</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-primary">{stats?.inProgress}</div>
          <div className="text-xs text-muted-foreground">Ενεργά</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-warning">{stats?.pending}</div>
          <div className="text-xs text-muted-foreground">Σε εκκρεμότητα</div>
        </div>
      </div>
      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-muted-foreground">Πρόοδος</span>
          <span className="font-medium text-foreground">
            {Math.round((stats?.completed / stats?.total) * 100)}%
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all duration-300"
            style={{ width: `${(stats?.completed / stats?.total) * 100}%` }}
          />
        </div>
      </div>
      {/* Last Sync Info */}
      {lastSync && (
        <div className="text-xs text-muted-foreground text-center">
          Τελευταίος συγχρονισμός: {formatSyncTime(lastSync)}
        </div>
      )}
    </div>
  );
};

export default DayHeader;