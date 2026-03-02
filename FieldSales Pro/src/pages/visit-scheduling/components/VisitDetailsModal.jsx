import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const VisitDetailsModal = ({ 
  isVisible, 
  onClose, 
  visit, 
  onSave, 
  onDelete,
  className = '' 
}) => {
  const [editedVisit, setEditedVisit] = useState(visit || {});

  const priorityOptions = [
    { value: 'low', label: 'Low Priority' },
    { value: 'medium', label: 'Medium Priority' },
    { value: 'high', label: 'High Priority' }
  ];

  const timeSlotOptions = [
    { value: '09:00-10:00', label: '9:00 AM - 10:00 AM' },
    { value: '10:00-11:00', label: '10:00 AM - 11:00 AM' },
    { value: '11:00-12:00', label: '11:00 AM - 12:00 PM' },
    { value: '14:00-15:00', label: '2:00 PM - 3:00 PM' },
    { value: '15:00-16:00', label: '3:00 PM - 4:00 PM' },
    { value: '16:00-17:00', label: '4:00 PM - 5:00 PM' }
  ];

  const visitTypeOptions = [
    { value: 'sales', label: 'Sales Call' },
    { value: 'follow-up', label: 'Follow-up' },
    { value: 'demo', label: 'Product Demo' },
    { value: 'support', label: 'Customer Support' },
    { value: 'meeting', label: 'Business Meeting' }
  ];

  const handleSave = () => {
    onSave(editedVisit);
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this visit?')) {
      onDelete(visit?.id);
      onClose();
    }
  };

  if (!isVisible || !visit) return null;

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${className}`}>
      <div className="bg-card border border-border rounded-lg shadow-elevation max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Visit Details</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {visit?.customerName} • {visit?.company}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <Icon name="X" size={20} />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="p-6 space-y-4">
            {/* Customer Information */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                  <Icon name="User" size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-foreground">{visit?.customerName}</div>
                  <div className="text-sm text-muted-foreground">{visit?.company}</div>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center space-x-1">
                      <Icon name="MapPin" size={12} />
                      <span>{visit?.location}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Icon name="Phone" size={12} />
                      <span>{visit?.phone}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visit Settings */}
            <div className="space-y-4">
              <Select
                label="Visit Type"
                options={visitTypeOptions}
                value={editedVisit?.type || 'sales'}
                onChange={(value) => setEditedVisit(prev => ({ ...prev, type: value }))}
              />

              <Select
                label="Priority Level"
                options={priorityOptions}
                value={editedVisit?.priority || 'medium'}
                onChange={(value) => setEditedVisit(prev => ({ ...prev, priority: value }))}
              />

              <Select
                label="Preferred Time Slot"
                options={timeSlotOptions}
                value={editedVisit?.timeSlot || ''}
                onChange={(value) => setEditedVisit(prev => ({ ...prev, timeSlot: value }))}
              />

              <Input
                label="Estimated Duration (minutes)"
                type="number"
                value={editedVisit?.duration || 60}
                onChange={(e) => setEditedVisit(prev => ({ 
                  ...prev, 
                  duration: parseInt(e?.target?.value) || 60 
                }))}
                placeholder="60"
              />

              <Input
                label="Visit Objective"
                type="text"
                value={editedVisit?.objective || ''}
                onChange={(e) => setEditedVisit(prev => ({ 
                  ...prev, 
                  objective: e?.target?.value 
                }))}
                placeholder="e.g., Product presentation, contract renewal"
              />

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Notes
                </label>
                <textarea
                  className="w-full p-3 border border-border rounded-md bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
                  rows={3}
                  value={editedVisit?.notes || ''}
                  onChange={(e) => setEditedVisit(prev => ({ 
                    ...prev, 
                    notes: e?.target?.value 
                  }))}
                  placeholder="Additional notes or preparation requirements..."
                />
              </div>
            </div>

            {/* Visit History */}
            {visit?.lastVisit && (
              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Previous Visit</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Date: {visit?.lastVisit}</div>
                  <div>Outcome: {visit?.lastOutcome || 'Meeting completed'}</div>
                  <div>Next Action: {visit?.nextAction || 'Follow-up call scheduled'}</div>
                </div>
              </div>
            )}

            {/* Travel Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border border-border rounded-lg text-center">
                <div className="text-lg font-semibold text-foreground">
                  {visit?.estimatedTravelTime || 25}m
                </div>
                <div className="text-xs text-muted-foreground">Travel Time</div>
              </div>
              <div className="p-3 border border-border rounded-lg text-center">
                <div className="text-lg font-semibold text-foreground">
                  {visit?.distance || '12.5'} km
                </div>
                <div className="text-xs text-muted-foreground">Distance</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <Button
              variant="destructive"
              onClick={handleDelete}
              iconName="Trash2"
              iconPosition="left"
            >
              Delete Visit
            </Button>
            
            <div className="flex items-center space-x-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="default" onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitDetailsModal;