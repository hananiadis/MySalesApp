import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const RouteOptimizer = ({ visits, onOptimizeRoute, isOptimizing }) => {
  const [showRouteDetails, setShowRouteDetails] = useState(false);

  const pendingVisits = visits?.filter(visit => 
    visit?.status === 'upcoming' || visit?.status === 'in-progress'
  );

  const calculateTotalDistance = () => {
    // Mock calculation - in real app would use actual coordinates
    return (pendingVisits?.length * 2.5)?.toFixed(1);
  };

  const calculateTotalTime = () => {
    // Mock calculation - in real app would use route optimization API
    const baseTime = pendingVisits?.length * 45; // 45 minutes per visit
    const travelTime = pendingVisits?.length * 15; // 15 minutes travel between visits
    return Math.round((baseTime + travelTime) / 60 * 10) / 10; // Convert to hours
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Icon name="Route" size={20} className="text-primary" />
          <h3 className="font-semibold text-foreground">Βελτιστοποίηση Διαδρομής</h3>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowRouteDetails(!showRouteDetails)}
        >
          <Icon name={showRouteDetails ? "ChevronUp" : "ChevronDown"} size={18} />
        </Button>
      </div>
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-lg font-semibold text-foreground">{pendingVisits?.length}</div>
          <div className="text-xs text-muted-foreground">Υπόλοιπο</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-accent">{calculateTotalDistance()} mi</div>
          <div className="text-xs text-muted-foreground">Απόσταση</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-warning">{calculateTotalTime()}h</div>
          <div className="text-xs text-muted-foreground">Εκτ. Χρόνος</div>
        </div>
      </div>
      {/* Optimize Button */}
      <Button
        variant="primary"
        fullWidth
        loading={isOptimizing}
        onClick={onOptimizeRoute}
        iconName="Navigation"
        iconPosition="left"
        disabled={pendingVisits?.length === 0}
      >
        {isOptimizing ? 'Βελτιστοποίηση Διαδρομής...' : 'Βελτιστοποίηση Διαδρομής Μου'}
      </Button>
      {/* Route Details */}
      {showRouteDetails && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="space-y-3">
            <div className="text-sm font-medium text-foreground mb-2">Σειρά Διαδρομής</div>
            
            {pendingVisits?.map((visit, index) => (
              <div key={visit?.id} className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs font-medium">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{visit?.customerName}</div>
                  <div className="text-xs text-muted-foreground">{visit?.scheduledTime}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {index < pendingVisits?.length - 1 ? '2.1 mi' : ''}
                </div>
              </div>
            ))}
          </div>

          {/* Navigation Options */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button variant="outline" size="sm" iconName="Navigation">
Χάρτες Google
            </Button>
            <Button variant="outline" size="sm" iconName="Map">
Χάρτες Apple
            </Button>
          </div>

          {/* Traffic Info */}
          <div className="mt-3 p-2 bg-muted/50 rounded-md">
            <div className="flex items-center space-x-2">
              <Icon name="AlertTriangle" size={14} className="text-warning" />
              <span className="text-xs text-muted-foreground">
                Μέτρια κίνηση στη Main St. Εξετάστε εναλλακτική διαδρομή.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteOptimizer;