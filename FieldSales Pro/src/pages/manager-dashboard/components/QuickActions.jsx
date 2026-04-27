import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const QuickActions = ({ className = '' }) => {
  const [activeAction, setActiveAction] = useState(null);

  const quickActions = [
    {
      id: 'territory-reassign',
      title: 'Επαναανάθεση Περιοχών',
      description: 'Επαναανάθεση περιοχών μεταξύ πωλητών',
      icon: 'Shuffle',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      action: () => setActiveAction('territory-reassign')
    },
    {
      id: 'priority-visits',
      title: 'Σήμανση Επισκέψεων Προτεραιότητας',
      description: 'Σημειώστε επισκέψεις πελατών υψηλής προτεραιότητας',
      icon: 'Flag',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      action: () => setActiveAction('priority-visits')
    },
    {
      id: 'bulk-messaging',
      title: 'Μαζική Αποστολή Μηνυμάτων Ομάδας',
      description: 'Στείλτε μηνύματα σε πολλά μέλη ομάδας',
      icon: 'MessageSquare',
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      action: () => setActiveAction('bulk-messaging')
    },
    {
      id: 'schedule-override',
      title: 'Παράκαμψη Προγράμματος',
      description: 'Παράκαμψη και προσαρμογή προγραμμάτων ομάδας',
      icon: 'Calendar',
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
      action: () => setActiveAction('schedule-override')
    }
  ];

  const teamMembers = [
    { id: 1, name: 'John Martinez', territory: 'North', status: 'active' },
    { id: 2, name: 'Sarah Chen', territory: 'South', status: 'active' },
    { id: 3, name: 'Michael Johnson', territory: 'East', status: 'break' },
    { id: 4, name: 'Emily Rodriguez', territory: 'West', status: 'active' }
  ];

  const renderActionPanel = () => {
    switch (activeAction) {
      case 'territory-reassign':
        return (
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Territory Reassignment</h4>
            <div className="space-y-2">
              {teamMembers?.map((member) => (
                <div key={member?.id} className="flex items-center justify-between p-2 border border-border rounded-md">
                  <div>
                    <div className="font-medium text-foreground">{member?.name}</div>
                    <div className="text-sm text-muted-foreground">{member?.territory} Territory</div>
                  </div>
                  <Button variant="outline" size="sm">
                    Επαναανάθεση
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );

      case 'priority-visits':
        return (
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Σήμανση Επισκέψεων Προτεραιότητας</h4>
            <div className="space-y-2">
              <div className="p-3 border border-border rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground">Acme Corporation</span>
                  <Button variant="outline" size="sm" iconName="Flag">
                    Σήμανση Προτεραιότητας
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">Προγραμματισμένο: Σήμερα 2:00 μ.μ.</div>
              </div>
              <div className="p-3 border border-border rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground">Tech Solutions Inc</span>
                  <Button variant="outline" size="sm" iconName="Flag">
                    Σήμανση Προτεραιότητας
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">Προγραμματισμένο: Αύριο 10:00 π.μ.</div>
              </div>
            </div>
          </div>
        );

      case 'bulk-messaging':
        return (
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Μαζική Αποστολή Μηνυμάτων Ομάδας</h4>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Επιλογή Παραληπτών
                </label>
                <div className="space-y-2">
                  {teamMembers?.map((member) => (
                    <label key={member?.id} className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded border-border" defaultChecked />
                      <span className="text-sm text-foreground">{member?.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Μήνυμα
                </label>
                <textarea
                  className="w-full p-2 border border-border rounded-md text-sm"
                  rows="3"
                  placeholder="Πληκτρολογήστε το μήνυμά σας..."
                />
              </div>
              <Button variant="default" className="w-full" iconName="Send">
                Αποστολή Μηνύματος
              </Button>
            </div>
          </div>
        );

      case 'schedule-override':
        return (
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Παράκαμψη Προγράμματος</h4>
            <div className="space-y-2">
              {teamMembers?.map((member) => (
                <div key={member?.id} className="p-3 border border-border rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">{member?.name}</span>
                    <Button variant="outline" size="sm" iconName="Edit">
                      Παράκαμψη
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Τρέχον: 8 επισκέψεις προγραμματισμένες σήμερα
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Quick Actions</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Διαχειριστείτε αποτελεσματικά τις λειτουργίες της ομάδας
        </p>
      </div>
      <div className="p-4">
        {!activeAction ? (
          <div className="grid grid-cols-1 gap-3">
            {quickActions?.map((action) => (
              <button
                key={action?.id}
                onClick={action?.action}
                className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors text-left"
              >
                <div className={`p-2 rounded-lg ${action?.bgColor}`}>
                  <Icon name={action?.icon} size={20} className={action?.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground text-sm">
                    {action?.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {action?.description}
                  </div>
                </div>
                <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : (
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <button
                onClick={() => setActiveAction(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon name="ArrowLeft" size={16} />
              </button>
              <span className="text-sm text-muted-foreground">Back to Actions</span>
            </div>
            {renderActionPanel()}
          </div>
        )}
      </div>
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Need help?</span>
          <button className="text-primary hover:text-primary/80 font-medium">
            Προβολή Οδηγού
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickActions;