import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const QuickActions = ({ onAddSpontaneousVisit, onEmergencyContact, onViewMap }) => {
  const [showActions, setShowActions] = useState(false);

  const quickActionItems = [
    {
      id: 'add-visit',
      label: 'Add Visit',
      icon: 'Plus',
      color: 'text-primary',
      action: onAddSpontaneousVisit,
      description: 'Add spontaneous visit'
    },
    {
      id: 'emergency',
      label: 'Emergency',
      icon: 'Phone',
      color: 'text-error',
      action: onEmergencyContact,
      description: 'Contact support'
    },
    {
      id: 'map-view',
      label: 'Map View',
      icon: 'Map',
      color: 'text-accent',
      action: onViewMap,
      description: 'View territory map'
    },
    {
      id: 'break',
      label: 'Take Break',
      icon: 'Coffee',
      color: 'text-warning',
      action: () => console.log('Break started'),
      description: 'Log break time'
    }
  ];

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Expanded Actions */}
      {showActions && (
        <div className="mb-4 space-y-2">
          {quickActionItems?.map((item) => (
            <div
              key={item?.id}
              className="flex items-center justify-end space-x-2 animate-in slide-in-from-right duration-200"
            >
              <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
                <div className="text-sm font-medium text-foreground">{item?.label}</div>
                <div className="text-xs text-muted-foreground">{item?.description}</div>
              </div>
              
              <Button
                variant="outline"
                size="icon"
                className="w-12 h-12 rounded-full shadow-lg bg-card"
                onClick={() => {
                  item?.action();
                  setShowActions(false);
                }}
              >
                <Icon name={item?.icon} size={20} className={item?.color} />
              </Button>
            </div>
          ))}
        </div>
      )}
      {/* Main FAB */}
      <Button
        variant={showActions ? "secondary" : "default"}
        size="icon"
        className="w-14 h-14 rounded-full shadow-lg"
        onClick={() => setShowActions(!showActions)}
      >
        <Icon 
          name={showActions ? "X" : "Plus"} 
          size={24} 
          className={`transition-transform duration-200 ${showActions ? 'rotate-90' : ''}`}
        />
      </Button>
    </div>
  );
};

export default QuickActions;