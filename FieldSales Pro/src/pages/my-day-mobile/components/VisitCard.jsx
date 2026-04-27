import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Image from '../../../components/AppImage';

const VisitCard = ({ visit, onCheckIn, onCheckOut, onReschedule, onAddNotes }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const getStatusColor = () => {
    switch (visit?.status) {
      case 'completed': return 'text-success';
      case 'in-progress': return 'text-primary';
      case 'overdue': return 'text-error';
      case 'upcoming': return 'text-warning';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = () => {
    switch (visit?.status) {
      case 'completed': return 'CheckCircle';
      case 'in-progress': return 'Clock';
      case 'overdue': return 'AlertTriangle';
      case 'upcoming': return 'Calendar';
      default: return 'Circle';
    }
  };

  const formatTime = (time) => {
    return new Date(`2025-11-07 ${time}`)?.toLocaleTimeString('el-GR', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm mb-4 overflow-hidden">
      {/* Main Visit Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-semibold text-foreground text-lg">{visit?.customerName}</h3>
              <div className={`flex items-center space-x-1 ${getStatusColor()}`}>
                <Icon name={getStatusIcon()} size={16} />
                <span className="text-xs font-medium capitalize">{visit?.status === 'completed' ? 'ολοκληρωμένη' : visit?.status === 'in-progress' ? 'σε εξέλιξη' : visit?.status === 'overdue' ? 'εκπρόθεσμη' : visit?.status === 'upcoming' ? 'επερχόμενη' : visit?.status}</span>
              </div>
            </div>
            <div className="flex items-center space-x-1 text-muted-foreground mb-2">
              <Icon name="MapPin" size={14} />
              <span className="text-sm">{visit?.address}</span>
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                <Icon name="Clock" size={14} className="text-primary" />
                <span className="font-medium">{formatTime(visit?.scheduledTime)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Icon name="Target" size={14} className="text-accent" />
                <span>{visit?.priority === 'high' ? 'Υψηλή' : visit?.priority === 'medium' ? 'Μεσαία' : visit?.priority === 'low' ? 'Χαμηλή' : visit?.priority}</span>
              </div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0"
          >
            <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={20} />
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2 mb-3">
          {visit?.status === 'upcoming' && (
            <Button
              variant="default"
              className="flex-1"
              onClick={() => onCheckIn(visit?.id)}
              iconName="MapPin"
              iconPosition="left"
            >
              Έναρξη Επίσκεψης
            </Button>
          )}
          
          {visit?.status === 'in-progress' && (
            <Button
              variant="success"
              className="flex-1"
              onClick={() => onCheckOut(visit?.id)}
              iconName="CheckCircle"
              iconPosition="left"
            >
              Ολοκλήρωση Επίσκεψης
            </Button>
          )}
          
          {visit?.status === 'completed' && (
            <Button
              variant="outline"
              className="flex-1"
              disabled
              iconName="CheckCircle"
              iconPosition="left"
            >
              Ολοκληρωμένη
            </Button>
          )}
          
          <Button
            variant="outline"
            onClick={() => onReschedule(visit?.id)}
            iconName="Calendar"
          />
          
          <Button
            variant="outline"
            onClick={() => setShowNotes(!showNotes)}
            iconName="MessageSquare"
          />
        </div>

        {/* Visit Objectives */}
        <div className="bg-muted/50 rounded-md p-3">
          <div className="text-xs font-medium text-muted-foreground mb-1">Στόχοι Επίσκεψης</div>
          <div className="text-sm text-foreground">{visit?.objectives}</div>
        </div>
      </div>
      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-border p-4 bg-muted/20">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Επικοινωνία</div>
              <div className="text-sm text-foreground">{visit?.contactPerson}</div>
              <div className="text-xs text-muted-foreground">{visit?.phone}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Τελευταία Επίσκεψη</div>
              <div className="text-sm text-foreground">{visit?.lastVisit}</div>
              <div className="text-xs text-muted-foreground">{visit?.lastOutcome}</div>
            </div>
          </div>

          {/* Customer Photo */}
          {visit?.customerPhoto && (
            <div className="mb-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">Τοποθεσία Πελάτη</div>
              <div className="w-full h-32 rounded-md overflow-hidden">
                <Image
                  src={visit?.customerPhoto}
                  alt={visit?.customerPhotoAlt}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" iconName="Phone">
              Κλήση
            </Button>
            <Button variant="outline" size="sm" iconName="Navigation">
              Πλοήγηση
            </Button>
            <Button variant="outline" size="sm" iconName="MessageCircle">
              Μήνυμα
            </Button>
          </div>
        </div>
      )}
      {/* Notes Section */}
      {showNotes && (
        <div className="border-t border-border p-4 bg-background">
          <div className="text-sm font-medium text-foreground mb-2">Σημειώσεις Επίσκεψης</div>
          <textarea
            className="w-full h-20 p-2 border border-border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Προσθέστε σημειώσεις για αυτή την επίσκεψη..."
            defaultValue={visit?.notes}
            onBlur={(e) => onAddNotes(visit?.id, e?.target?.value)}
          />
          <div className="flex justify-between items-center mt-2">
            <Button variant="ghost" size="sm" iconName="Mic">
              Φωνητική Σημείωση
            </Button>
            <Button variant="ghost" size="sm" iconName="Camera">
              Προσθήκη Φωτογραφίας
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitCard;