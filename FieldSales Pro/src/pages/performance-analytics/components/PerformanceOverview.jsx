import React from 'react';
import Icon from '../../../components/AppIcon';

const PerformanceOverview = () => {
  const overviewMetrics = [
    {
      id: 1,
      title: "Visit Completion Rate",
      value: "87.3%",
      change: "+5.2%",
      trend: "up",
      icon: "Target",
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      id: 2,
      title: "Average Time per Visit",
      value: "42 min",
      change: "-3.1%",
      trend: "down",
      icon: "Clock",
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      id: 3,
      title: "Travel Efficiency",
      value: "78.9%",
      change: "+8.7%",
      trend: "up",
      icon: "Route",
      color: "text-accent",
      bgColor: "bg-accent/10"
    },
    {
      id: 4,
      title: "Visit-to-Order Rate",
      value: "34.2%",
      change: "+2.4%",
      trend: "up",
      icon: "TrendingUp",
      color: "text-warning",
      bgColor: "bg-warning/10"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {overviewMetrics?.map((metric) => (
        <div key={metric?.id} className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-lg ${metric?.bgColor} flex items-center justify-center`}>
              <Icon name={metric?.icon} size={24} className={metric?.color} />
            </div>
            <div className={`flex items-center space-x-1 text-sm ${
              metric?.trend === 'up' ? 'text-success' : 'text-error'
            }`}>
              <Icon 
                name={metric?.trend === 'up' ? 'ArrowUp' : 'ArrowDown'} 
                size={16} 
              />
              <span className="font-medium">{metric?.change}</span>
            </div>
          </div>
          
          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-foreground">{metric?.value}</h3>
            <p className="text-sm text-muted-foreground">{metric?.title}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PerformanceOverview;