import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

// Map API activity items to display-friendly shape
function normalizeActivity(item) {
  const typeMessages = {
    visit_completed: 'ολοκλήρωσε επίσκεψη',
    check_in: 'ξεκίνησε επίσκεψη (check-in)',
    visit_missed: 'έχασε προγραμματισμένη επίσκεψη',
  };
  const priorities = {
    visit_completed: 'normal',
    check_in: 'low',
    visit_missed: 'high',
  };
  return {
    id: item.id,
    type: item.type,
    salesman: item.salesmanName,
    customer: item.customerName,
    message: typeMessages[item.type] || item.type,
    timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
    priority: priorities[item.type] || 'normal',
    outcome: item.outcome,
  };
}

const ActivityFeed = ({ className = '', activities: activitiesProp = null }) => {
  const [filter, setFilter] = useState('all');

  const activities = activitiesProp ? activitiesProp.map(normalizeActivity) : null;

  const getActivityIcon = (type) => {
    switch (type) {
      case 'visit_completed': return 'CheckCircle';
      case 'check_in': return 'MapPin';
      case 'visit_missed': return 'AlertTriangle';
      case 'schedule_change': return 'Calendar';
      case 'alert': return 'AlertTriangle';
      case 'territory_update': return 'Map';
      default: return 'Bell';
    }
  };

  const getActivityColor = (type, outcome) => {
    if (type === 'alert') return 'text-error';
    if (outcome === 'positive') return 'text-success';
    if (outcome === 'negative') return 'text-error';
    return 'text-primary';
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      high: 'bg-error text-error-foreground',
      medium: 'bg-warning text-warning-foreground',
      low: 'bg-muted text-muted-foreground',
      normal: 'bg-primary text-primary-foreground'
    };
    return colors?.[priority] || colors?.normal;
  };

  const getPriorityLabel = (priority) => {
    const labels = {
      high: 'υψηλή',
      medium: 'μεσαία',
      low: 'χαμηλή',
      normal: 'κανονική'
    };
    return labels?.[priority] || priority;
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 60) return `${minutes}λ πριν`;
    if (hours < 24) return `${hours}ω πριν`;
    return timestamp?.toLocaleDateString();
  };

  const filteredActivities = (activities || []).filter(activity => {
    if (filter === 'all') return true;
    if (filter === 'alerts') return activity?.type === 'alert' || activity?.type === 'visit_missed';
    if (filter === 'visits') return activity?.type === 'visit_completed' || activity?.type === 'check_in';
    if (filter === 'changes') return activity?.type === 'schedule_change';
    return true;
  });

  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Real-time Activity</h3>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
            <span className="text-xs text-muted-foreground">Ζωντανά</span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-1">
          {[
            { key: 'all', label: 'Όλα' },
            { key: 'visits', label: 'Επισκέψεις' },
            { key: 'alerts', label: 'Ειδοποιήσεις' },
            { key: 'changes', label: 'Αλλαγές' }
          ]?.map((tab) => (
            <button
              key={tab?.key}
              onClick={() => setFilter(tab?.key)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                filter === tab?.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {tab?.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {activities === null ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start space-x-3 animate-pulse">
                <div className="w-6 h-6 rounded-full bg-muted mt-1" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="p-8 text-center">
            <Icon name="Activity" size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Δεν βρέθηκαν δραστηριότητες</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredActivities?.map((activity) => (
              <div
                key={activity?.id}
                className="flex items-start space-x-3 p-4 hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className={`p-1 rounded-full ${getActivityColor(activity?.type, activity?.outcome)?.replace('text-', 'bg-')}/10`}>
                  <Icon
                    name={getActivityIcon(activity?.type)}
                    size={16}
                    className={getActivityColor(activity?.type, activity?.outcome)}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-foreground text-sm">
                      {activity?.salesman}
                    </span>
                    {activity?.priority !== 'normal' && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityBadge(activity?.priority)}`}>
                        {getPriorityLabel(activity?.priority)}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-1">
                    {activity?.message}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">
                      {activity?.customer}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(activity?.timestamp)}
                    </span>
                  </div>
                </div>

                <button className="text-muted-foreground hover:text-foreground">
                  <Icon name="MoreVertical" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-4 border-t border-border">
        <button className="w-full text-sm text-primary hover:text-primary/80 font-medium">
          Προβολή Όλων των Δραστηριοτήτων
        </button>
      </div>
    </div>
  );
};

export default ActivityFeed;