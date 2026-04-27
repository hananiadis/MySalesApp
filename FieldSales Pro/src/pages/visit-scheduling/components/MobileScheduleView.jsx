import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const MobileScheduleView = ({ 
  currentDate, 
  onDateChange, 
  scheduledVisits, 
  onVisitClick,
  onAddVisit,
  className = '' 
}) => {
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const formatDate = (date) => {
    return date?.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getVisitsForDate = (date) => {
    const dateStr = date?.toISOString()?.split('T')?.[0];
    return scheduledVisits?.filter(visit => visit?.date === dateStr);
  };

  const dayVisits = getVisitsForDate(currentDate);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'border-l-error bg-error/5';
      case 'medium': return 'border-l-warning bg-warning/5';
      default: return 'border-l-muted-foreground bg-muted/5';
    }
  };

  const getStatusMeta = (status) => {
    switch (String(status || '').toLowerCase()) {
      case 'completed':
        return { label: 'Ολοκληρώθηκε', className: 'bg-success/10 text-success' };
      case 'in-progress':
        return { label: 'Σε εξέλιξη', className: 'bg-primary/10 text-primary' };
      case 'overdue':
        return { label: 'Εκπρόθεσμη', className: 'bg-error/10 text-error' };
      case 'cancelled':
        return { label: 'Ακυρώθηκε', className: 'bg-muted text-muted-foreground' };
      default:
        return { label: 'Προγραμματισμένη', className: 'bg-warning/10 text-warning' };
    }
  };

  const getTotalTravelTime = (visits) => {
    return visits?.reduce((total, visit) => total + (visit?.estimatedTravelTime || 0), 0);
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      {/* Date Navigation */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDateChange(-1)}
          >
            <Icon name="ChevronLeft" size={20} />
          </Button>
          
          <div className="text-center">
            <div className="text-lg font-semibold text-foreground">
              {formatDate(currentDate)}
            </div>
            <div className="text-sm text-muted-foreground">
              {dayVisits?.length} επισκέψεις • {formatTime(getTotalTravelTime(dayVisits))} μετακίνηση
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDateChange(1)}
          >
            <Icon name="ChevronRight" size={20} />
          </Button>
        </div>
      </div>
      {/* Visit List */}
      <div className="p-4">
        {dayVisits?.length === 0 ? (
          <div className="text-center py-12">
            <Icon name="Calendar" size={48} className="text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Δεν υπάρχουν επισκέψεις για αυτή την ημέρα</p>
            <Button
              variant="outline"
              onClick={() => setShowCustomerModal(true)}
              iconName="Plus"
              iconPosition="left"
            >
              Add Visit
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {dayVisits?.map((visit, index) => {
              const statusMeta = getStatusMeta(visit?.status);
              return (
              <div
                key={visit?.id}
                onClick={() => onVisitClick(visit)}
                className={`p-4 rounded-lg border-l-4 cursor-pointer transition-all duration-200 hover:shadow-sm ${getPriorityColor(visit?.priority)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium text-muted-foreground">
                        #{index + 1}
                      </span>
                      <div className="text-base font-semibold text-foreground truncate">
                        {visit?.customerName}
                      </div>
                    </div>
                    <span className={`inline-flex mb-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                    
                    <div className="text-sm text-muted-foreground truncate mb-2">
                      {visit?.company}
                    </div>

                    {visit?.timeSlot && (
                      <div className="flex items-center space-x-1 text-sm text-foreground mb-2">
                        <Icon name="Clock" size={14} />
                        <span>{visit?.timeSlot}</span>
                      </div>
                    )}

                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span className="flex items-center space-x-1">
                        <Icon name="MapPin" size={12} />
                        <span>{visit?.location}</span>
                      </span>
                      {visit?.estimatedTravelTime > 0 && (
                        <span className="flex items-center space-x-1">
                          <Icon name="Navigation" size={12} />
                          <span>{formatTime(visit?.estimatedTravelTime)}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 ml-3">
                    <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
                  </div>
                </div>

                {visit?.objective && (
                  <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                    <strong>Στόχος:</strong> {visit?.objective}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Quick Actions */}
      {dayVisits?.length > 0 && (
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => setShowCustomerModal(true)}
              iconName="Plus"
              iconPosition="left"
              fullWidth
            >
              Add Visit
            </Button>
            <Button
              variant="outline"
              onClick={() => {/* Handle route optimization */}}
              iconName="Route"
              iconPosition="left"
              fullWidth
            >
              Βελτιστοποίηση Διαδρομής
            </Button>
          </div>
        </div>
      )}
      {/* Customer Selection Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-card border border-border rounded-t-lg w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Προσθήκη Επίσκεψης</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCustomerModal(false)}
                >
                  <Icon name="X" size={20} />
                </Button>
              </div>
            </div>
            
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-4">
                Επιλέξτε πελάτες για προγραμματισμό επισκέψεων στις {formatDate(currentDate)}
              </p>
              <Button
                variant="default"
                onClick={() => {
                  onAddVisit(currentDate);
                  setShowCustomerModal(false);
                }}
                fullWidth
              >
                Άνοιγμα Επιλογής Πελατών
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileScheduleView;