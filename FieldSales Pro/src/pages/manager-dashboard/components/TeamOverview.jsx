import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const TeamOverview = ({ className = '', salesmen = null }) => {
  const [selectedMember, setSelectedMember] = useState(null);

  // Derive display data from real API response
  const teamData = (salesmen || []).map((s) => {
    const status = s.visitsInProgress > 0 ? 'active' : s.visitsCompleted > 0 ? 'active' : 'offline';
    return {
      id: s.uid,
      name: s.displayName,
      territory: s.territory || '—',
      status,
      visitsToday: { completed: s.visitsCompleted, planned: s.visitsPlanned },
      efficiency: s.efficiency,
      lastActivityAt: s.lastActivityAt,
    };
  });


  const getStatusColor = (status) => {
    switch (status) {
      case 'active':return 'text-success';
      case 'break':return 'text-warning';
      case 'offline':return 'text-error';
      default:return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':return 'MapPin';
      case 'break':return 'Coffee';
      case 'offline':return 'WifiOff';
      default:return 'User';
    }
  };

  const getEfficiencyColor = (efficiency) => {
    if (efficiency >= 90) return 'text-success';
    if (efficiency >= 75) return 'text-warning';
    return 'text-error';
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const diff = now - new Date(timestamp);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Μόλις τώρα';
    if (minutes < 60) return `${minutes}λ πριν`;
    return `${Math.floor(minutes / 60)}ω πριν`;
  };

  const getInitials = (name = '') => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (name.slice(0, 2) || '?').toUpperCase();
  };

  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Επισκόπηση Ομάδας</h3>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-success rounded-full" />
              <span className="text-xs text-muted-foreground">
                {teamData.filter((m) => m.status === 'active').length} Ενεργοί
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-error rounded-full" />
              <span className="text-xs text-muted-foreground">
                {teamData.filter((m) => m.status === 'offline').length} Εκτός
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="p-4">
        {salesmen === null && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 border border-border rounded-lg animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted rounded w-32" />
                    <div className="h-2 bg-muted rounded w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-3">
          {teamData?.map((member) =>
          <div
            key={member?.id}
            className={`p-3 border border-border rounded-lg cursor-pointer transition-all hover:shadow-sm ${
            selectedMember?.id === member?.id ? 'bg-muted' : 'hover:bg-muted/50'}`
            }
            onClick={() => setSelectedMember(selectedMember?.id === member?.id ? null : member)}>

              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {getInitials(member?.name)}
                    </span>
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-card ${
                    member?.status === 'active' ? 'bg-success' : 'bg-error'}`
                  } />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-foreground truncate">
                      {member?.name}
                    </h4>
                    <Icon
                    name={getStatusIcon(member?.status)}
                    size={14}
                    className={getStatusColor(member?.status)} />

                  </div>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-sm text-muted-foreground">
                      {member?.territory}
                    </span>
                    {member?.lastActivityAt && (
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(member?.lastActivityAt)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-medium text-foreground">
                    {member?.visitsToday?.completed}/{member?.visitsToday?.planned}
                  </div>
                  <div className={`text-xs font-medium ${getEfficiencyColor(member?.efficiency)}`}>
                    {member?.efficiency}% αποδοτικότητα
                  </div>
                </div>

                <Icon
                name={selectedMember?.id === member?.id ? "ChevronUp" : "ChevronDown"}
                size={16}
                className="text-muted-foreground" />

              </div>

              {/* Expanded Details */}
              {selectedMember?.id === member?.id &&
            <div className="mt-4 pt-4 border-t border-border">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Ολοκληρωμένες</div>
                      <div className="text-sm font-medium text-success">{member?.visitsToday?.completed}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Προγραμματισμένες</div>
                      <div className="text-sm font-medium text-foreground">{member?.visitsToday?.planned}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Αποδοτικότητα</div>
                      <div className={`text-sm font-medium ${member?.efficiency >= 90 ? 'text-success' : member?.efficiency >= 70 ? 'text-warning' : 'text-error'}`}>
                        {member?.efficiency}%
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" iconName="MapPin">
                      Παρακολούθηση Τοποθεσίας
                    </Button>
                    <Button variant="outline" size="sm" iconName="MessageSquare">
                      Μήνυμα
                    </Button>
                    <Button variant="outline" size="sm" iconName="Phone">
                      Κλήση
                    </Button>
                  </div>
                </div>
            }
            </div>
          )}
        </div>
      </div>
      <div className="p-4 border-t border-border">
        <Button variant="outline" className="w-full" iconName="Users">
          Προβολή Αναλυτικής Αναφοράς Ομάδας
        </Button>
      </div>
    </div>);

};

export default TeamOverview;