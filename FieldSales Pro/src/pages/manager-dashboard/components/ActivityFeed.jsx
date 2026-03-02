import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';

const ActivityFeed = ({ className = '' }) => {
  const [activities, setActivities] = useState([]);
  const [filter, setFilter] = useState('all');

  const mockActivities = [
    {
      id: 1,
      type: 'visit_completed',
      salesman: 'John Martinez',
      customer: 'Acme Corporation',
      message: 'completed visit with successful product demo',
      timestamp: new Date(Date.now() - 300000),
      priority: 'normal',
      outcome: 'positive'
    },
    {
      id: 2,
      type: 'schedule_change',
      salesman: 'Sarah Chen',
      customer: 'Tech Solutions Inc',
      message: 'rescheduled visit due to client request',
      timestamp: new Date(Date.now() - 600000),
      priority: 'medium',
      outcome: 'neutral'
    },
    {
      id: 3,
      type: 'alert',
      salesman: 'Michael Johnson',
      customer: 'Global Industries',
      message: 'missed scheduled visit - requires follow-up',
      timestamp: new Date(Date.now() - 900000),
      priority: 'high',
      outcome: 'negative'
    },
    {
      id: 4,
      type: 'visit_completed',
      salesman: 'Emily Rodriguez',
      customer: 'StartUp Hub',
      message: 'completed visit with order placement',
      timestamp: new Date(Date.now() - 1200000),
      priority: 'normal',
      outcome: 'positive'
    },
    {
      id: 5,
      type: 'territory_update',
      salesman: 'John Martinez',
      customer: 'Multiple Customers',
      message: 'territory boundaries updated for North region',
      timestamp: new Date(Date.now() - 1800000),
      priority: 'low',
      outcome: 'neutral'
    },
    {
      id: 6,
      type: 'visit_completed',
      salesman: 'Sarah Chen',
      customer: 'Enterprise Corp',
      message: 'completed visit with contract negotiation',
      timestamp: new Date(Date.now() - 2100000),
      priority: 'normal',
      outcome: 'positive'
    }
  ];

  useEffect(() => {
    setActivities(mockActivities);
  }, []);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'visit_completed': return 'CheckCircle';
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

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return timestamp?.toLocaleDateString();
  };

  const filteredActivities = activities?.filter(activity => {
    if (filter === 'all') return true;
    if (filter === 'alerts') return activity?.type === 'alert';
    if (filter === 'visits') return activity?.type === 'visit_completed';
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
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'visits', label: 'Visits' },
            { key: 'alerts', label: 'Alerts' },
            { key: 'changes', label: 'Changes' }
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
        {filteredActivities?.length === 0 ? (
          <div className="p-8 text-center">
            <Icon name="Activity" size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No activities found</p>
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
                        {activity?.priority}
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
          View All Activities
        </button>
      </div>
    </div>
  );
};

export default ActivityFeed;