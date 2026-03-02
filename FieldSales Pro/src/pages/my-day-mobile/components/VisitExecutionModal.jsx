import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { Checkbox } from '../../../components/ui/Checkbox';

const VisitExecutionModal = ({ visit, isOpen, onClose, onComplete }) => {
  const [checklist, setChecklist] = useState({
    meetDecisionMaker: false,
    presentProducts: false,
    discussNeeds: false,
    provideQuote: false,
    scheduleFollowup: false
  });
  
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [attachments, setAttachments] = useState([]);

  if (!isOpen) return null;

  const handleChecklistChange = (key, checked) => {
    setChecklist(prev => ({
      ...prev,
      [key]: checked
    }));
  };

  const handleComplete = () => {
    const visitData = {
      id: visit?.id,
      checklist,
      outcome,
      notes,
      nextAction,
      attachments,
      completedAt: new Date()
    };
    onComplete(visitData);
    onClose();
  };

  const checklistItems = [
    { key: 'meetDecisionMaker', label: 'Met with decision maker' },
    { key: 'presentProducts', label: 'Presented products/services' },
    { key: 'discussNeeds', label: 'Discussed customer needs' },
    { key: 'provideQuote', label: 'Provided quote/proposal' },
    { key: 'scheduleFollowup', label: 'Scheduled follow-up' }
  ];

  const outcomeOptions = [
    'Successful meeting - Quote provided',
    'Information gathering - Follow-up needed',
    'Customer not available - Rescheduled',
    'No interest at this time',
    'Competitor already selected',
    'Budget constraints - Future opportunity'
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-card rounded-t-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Complete Visit</h2>
            <p className="text-sm text-muted-foreground">{visit?.customerName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <Icon name="X" size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Visit Checklist */}
          <div className="mb-6">
            <h3 className="font-medium text-foreground mb-3">Visit Checklist</h3>
            <div className="space-y-3">
              {checklistItems?.map((item) => (
                <Checkbox
                  key={item?.key}
                  label={item?.label}
                  checked={checklist?.[item?.key]}
                  onChange={(e) => handleChecklistChange(item?.key, e?.target?.checked)}
                />
              ))}
            </div>
          </div>

          {/* Outcome Selection */}
          <div className="mb-6">
            <h3 className="font-medium text-foreground mb-3">Visit Outcome</h3>
            <div className="space-y-2">
              {outcomeOptions?.map((option) => (
                <label
                  key={option}
                  className={`flex items-center p-3 border border-border rounded-md cursor-pointer transition-colors ${
                    outcome === option ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="outcome"
                    value={option}
                    checked={outcome === option}
                    onChange={(e) => setOutcome(e?.target?.value)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                    outcome === option ? 'border-primary' : 'border-muted-foreground'
                  }`}>
                    {outcome === option && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="text-sm text-foreground">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <Input
              label="Visit Notes"
              type="text"
              placeholder="Add detailed notes about the visit..."
              value={notes}
              onChange={(e) => setNotes(e?.target?.value)}
              description="Include key discussion points and customer feedback"
            />
          </div>

          {/* Next Action */}
          <div className="mb-6">
            <Input
              label="Next Action Required"
              type="text"
              placeholder="What needs to be done next?"
              value={nextAction}
              onChange={(e) => setNextAction(e?.target?.value)}
              description="Follow-up tasks or next steps"
            />
          </div>

          {/* Attachments */}
          <div className="mb-6">
            <h3 className="font-medium text-foreground mb-3">Attachments</h3>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-20 flex-col"
                iconName="Camera"
              >
                <span className="text-xs mt-1">Take Photo</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex-col"
                iconName="FileText"
              >
                <span className="text-xs mt-1">Add Document</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex-col"
                iconName="Mic"
              >
                <span className="text-xs mt-1">Voice Note</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex-col"
                iconName="PenTool"
              >
                <span className="text-xs mt-1">Signature</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20">
          <div className="flex space-x-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Save Draft
            </Button>
            <Button
              variant="default"
              className="flex-1"
              onClick={handleComplete}
              disabled={!outcome}
            >
              Complete Visit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitExecutionModal;