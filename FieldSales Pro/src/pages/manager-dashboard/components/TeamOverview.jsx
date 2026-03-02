import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const TeamOverview = ({ className = '' }) => {
  const [selectedMember, setSelectedMember] = useState(null);

  const teamData = [
  {
    id: 1,
    name: 'John Martinez',
    avatar: "/assets/images/avatar-placeholder.png",
    avatarAlt: 'Professional headshot of Hispanic man with short dark hair in navy suit',
    territory: 'North Territory',
    status: 'active',
    currentLocation: 'Acme Corporation',
    visitsToday: { completed: 8, planned: 12 },
    efficiency: 92,
    lastUpdate: new Date(Date.now() - 300000),
    todayStats: {
      distance: '45.2 km',
      timeSpent: '6.5 hrs',
      outcomes: { positive: 6, neutral: 2, negative: 0 }
    }
  },
  {
    id: 2,
    name: 'Sarah Chen',
    avatar: "/assets/images/avatar-placeholder.png",
    avatarAlt: 'Professional headshot of Asian woman with long black hair in white blazer',
    territory: 'South Territory',
    status: 'active',
    currentLocation: 'Tech Solutions Inc',
    visitsToday: { completed: 6, planned: 10 },
    efficiency: 88,
    lastUpdate: new Date(Date.now() - 600000),
    todayStats: {
      distance: '38.7 km',
      timeSpent: '5.2 hrs',
      outcomes: { positive: 4, neutral: 2, negative: 0 }
    }
  },
  {
    id: 3,
    name: 'Michael Johnson',
    avatar: "/assets/images/avatar-placeholder.png",
    avatarAlt: 'Professional headshot of African American man with beard in dark suit',
    territory: 'East Territory',
    status: 'break',
    currentLocation: 'Lunch Break',
    visitsToday: { completed: 4, planned: 8 },
    efficiency: 75,
    lastUpdate: new Date(Date.now() - 900000),
    todayStats: {
      distance: '22.1 km',
      timeSpent: '3.8 hrs',
      outcomes: { positive: 2, neutral: 1, negative: 1 }
    }
  },
  {
    id: 4,
    name: 'Emily Rodriguez',
    avatar: "/assets/images/avatar-placeholder.png",
    avatarAlt: 'Professional headshot of Latina woman with brown hair in blue business suit',
    territory: 'West Territory',
    status: 'active',
    currentLocation: 'StartUp Hub',
    visitsToday: { completed: 9, planned: 11 },
    efficiency: 95,
    lastUpdate: new Date(Date.now() - 180000),
    todayStats: {
      distance: '52.3 km',
      timeSpent: '7.1 hrs',
      outcomes: { positive: 7, neutral: 2, negative: 0 }
    }
  }];


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
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Team Overview</h3>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-success rounded-full" />
              <span className="text-xs text-muted-foreground">3 Active</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-warning rounded-full" />
              <span className="text-xs text-muted-foreground">1 Break</span>
            </div>
          </div>
        </div>
      </div>
      <div className="p-4">
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
                  <img
                  src={member?.avatar}
                  alt={member?.avatarAlt}
                  className="w-10 h-10 rounded-full object-cover" />

                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-card ${
                member?.status === 'active' ? 'bg-success' :
                member?.status === 'break' ? 'bg-warning' : 'bg-error'}`
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
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(member?.lastUpdate)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-medium text-foreground">
                    {member?.visitsToday?.completed}/{member?.visitsToday?.planned}
                  </div>
                  <div className={`text-xs font-medium ${getEfficiencyColor(member?.efficiency)}`}>
                    {member?.efficiency}% efficiency
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
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Current Location</div>
                      <div className="text-sm font-medium text-foreground">
                        {member?.currentLocation}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Distance Traveled</div>
                      <div className="text-sm font-medium text-foreground">
                        {member?.todayStats?.distance}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Time Spent</div>
                      <div className="text-sm font-medium text-foreground">
                        {member?.todayStats?.timeSpent}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Outcomes</div>
                      <div className="flex space-x-2">
                        <span className="text-xs text-success">
                          +{member?.todayStats?.outcomes?.positive}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ={member?.todayStats?.outcomes?.neutral}
                        </span>
                        <span className="text-xs text-error">
                          -{member?.todayStats?.outcomes?.negative}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" iconName="MapPin">
                      Track Location
                    </Button>
                    <Button variant="outline" size="sm" iconName="MessageSquare">
                      Message
                    </Button>
                    <Button variant="outline" size="sm" iconName="Phone">
                      Call
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
          View Detailed Team Report
        </Button>
      </div>
    </div>);

};

export default TeamOverview;