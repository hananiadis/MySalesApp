import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const Customer360Modal = ({ customer, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen || !customer) return null;

  const visitHistory = [
    {
      id: 1,
      date: '2024-11-05',
      salesman: 'John Smith',
      outcome: 'Quote Provided',
      notes: 'Discussed new product line requirements. Customer interested in bulk pricing.',
      duration: 45,
      orderValue: 2500
    },
    {
      id: 2,
      date: '2024-10-22',
      salesman: 'John Smith',
      outcome: 'Follow-up Required',
      notes: 'Customer needs approval from procurement team. Schedule follow-up in 2 weeks.',
      duration: 30,
      orderValue: 0
    },
    {
      id: 3,
      date: '2024-10-08',
      salesman: 'Sarah Johnson',
      outcome: 'Order Placed',
      notes: 'Successful sale of premium package. Customer satisfied with service.',
      duration: 60,
      orderValue: 4200
    }
  ];

  const performanceMetrics = {
    totalVisits: 24,
    averageOrderValue: 3200,
    conversionRate: 68,
    engagementScore: 85,
    lifetimeValue: 45600,
    lastOrderDate: '2024-11-05'
  };

  const territoryOptions = [
    { value: 'north', label: 'North Region' },
    { value: 'south', label: 'South Region' },
    { value: 'east', label: 'East Region' },
    { value: 'west', label: 'West Region' },
    { value: 'central', label: 'Central Region' }
  ];

  const priorityOptions = [
    { value: 'high', label: 'High Priority' },
    { value: 'medium', label: 'Medium Priority' },
    { value: 'low', label: 'Low Priority' }
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'User' },
    { id: 'visits', label: 'Visit History', icon: 'Calendar' },
    { id: 'analytics', label: 'Analytics', icon: 'BarChart3' },
    { id: 'settings', label: 'Settings', icon: 'Settings' }
  ];

  const getOutcomeBadge = (outcome) => {
    const configs = {
      'Order Placed': { color: 'bg-success text-success-foreground', icon: 'CheckCircle' },
      'Quote Provided': { color: 'bg-warning text-warning-foreground', icon: 'FileText' },
      'Follow-up Required': { color: 'bg-primary text-primary-foreground', icon: 'Clock' },
      'No Interest': { color: 'bg-error text-error-foreground', icon: 'XCircle' }
    };
    
    const config = configs?.[outcome] || configs?.['Follow-up Required'];
    return (
      <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${config?.color}`}>
        <Icon name={config?.icon} size={12} />
        <span>{outcome}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-elevation w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-4">
            <Image
              src={customer?.avatar}
              alt={customer?.avatarAlt}
              className="w-16 h-16 rounded-full object-cover"
            />
            <div>
              <h2 className="text-xl font-semibold text-foreground">{customer?.name}</h2>
              <p className="text-muted-foreground">{customer?.company}</p>
              <div className="flex items-center space-x-2 mt-1">
                <Icon name="MapPin" size={14} className="text-primary" />
                <span className="text-sm text-muted-foreground">{customer?.territory}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <Icon name="X" size={20} />
          </Button>
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <nav className="flex space-x-1 px-6">
            {tabs?.map((tab) => (
              <button
                key={tab?.id}
                onClick={() => setActiveTab(tab?.id)}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab?.id
                    ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name={tab?.icon} size={16} />
                <span>{tab?.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{performanceMetrics?.totalVisits}</div>
                  <div className="text-sm text-muted-foreground">Total Visits</div>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">${performanceMetrics?.averageOrderValue?.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Avg Order Value</div>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{performanceMetrics?.conversionRate}%</div>
                  <div className="text-sm text-muted-foreground">Conversion Rate</div>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{performanceMetrics?.engagementScore}</div>
                  <div className="text-sm text-muted-foreground">Engagement Score</div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-muted/30 p-4 rounded-lg">
                <h3 className="font-semibold text-foreground mb-3">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Icon name="Mail" size={14} className="text-muted-foreground" />
                    <span>{customer?.email}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Icon name="Phone" size={14} className="text-muted-foreground" />
                    <span>{customer?.phone}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Icon name="Building" size={14} className="text-muted-foreground" />
                    <span>{customer?.address}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Icon name="Calendar" size={14} className="text-muted-foreground" />
                    <span>Last Order: {performanceMetrics?.lastOrderDate}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'visits' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Recent Visits</h3>
                <Button variant="outline" iconName="Plus" iconPosition="left">
                  Schedule Visit
                </Button>
              </div>
              
              <div className="space-y-3">
                {visitHistory?.map((visit) => (
                  <div key={visit?.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="text-sm font-medium text-foreground">
                          {new Date(visit.date)?.toLocaleDateString()}
                        </div>
                        {getOutcomeBadge(visit?.outcome)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {visit?.duration} min
                      </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground mb-2">
                      Salesman: {visit?.salesman}
                    </div>
                    
                    <p className="text-sm text-foreground mb-2">{visit?.notes}</p>
                    
                    {visit?.orderValue > 0 && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Icon name="DollarSign" size={14} className="text-success" />
                        <span className="text-success font-medium">
                          Order Value: ${visit?.orderValue?.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <h3 className="font-semibold text-foreground">Performance Analytics</h3>
              
              {/* Performance Chart Placeholder */}
              <div className="bg-muted/30 p-8 rounded-lg text-center">
                <Icon name="BarChart3" size={48} className="text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Visit frequency and order correlation chart would be displayed here</p>
              </div>

              {/* Detailed Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium text-foreground">Visit Patterns</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Average visits per month:</span>
                      <span className="font-medium">4.2</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preferred visit time:</span>
                      <span className="font-medium">10:00 AM - 12:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Visit success rate:</span>
                      <span className="font-medium text-success">85%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-foreground">Revenue Impact</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lifetime value:</span>
                      <span className="font-medium">${performanceMetrics?.lifetimeValue?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Revenue per visit:</span>
                      <span className="font-medium">${(performanceMetrics?.lifetimeValue / performanceMetrics?.totalVisits)?.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Growth trend:</span>
                      <span className="font-medium text-success">+12% YoY</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h3 className="font-semibold text-foreground">Customer Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Select
                  label="Territory Assignment"
                  options={territoryOptions}
                  value={customer?.territory?.toLowerCase()}
                  onChange={() => {}}
                />

                <Select
                  label="Priority Level"
                  options={priorityOptions}
                  value={customer?.priority}
                  onChange={() => {}}
                />
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-foreground">Visit Preferences</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Preferred Visit Frequency</label>
                    <select className="w-full p-2 border border-border rounded-md bg-input">
                      <option>Every 2 weeks</option>
                      <option>Monthly</option>
                      <option>Quarterly</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Best Contact Time</label>
                    <select className="w-full p-2 border border-border rounded-md bg-input">
                      <option>Morning (9-12 PM)</option>
                      <option>Afternoon (1-5 PM)</option>
                      <option>Any time</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-border">
                <Button variant="outline">Cancel</Button>
                <Button variant="default">Save Changes</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Customer360Modal;