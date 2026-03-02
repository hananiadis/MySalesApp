import React from 'react';
import Icon from '../../../components/AppIcon';

const PerformanceMetrics = ({ className = '' }) => {
  const metricsData = [
    {
      id: 'visits-completed',
      title: 'Visits Completed',
      value: '27',
      target: '32',
      percentage: 84,
      trend: 'up',
      trendValue: '+12%',
      icon: 'CheckCircle',
      color: 'text-success',
      bgColor: 'bg-success/10'
    },
    {
      id: 'territory-coverage',
      title: 'Territory Coverage',
      value: '78%',
      target: '85%',
      percentage: 92,
      trend: 'up',
      trendValue: '+5%',
      icon: 'Map',
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    {
      id: 'revenue-attribution',
      title: 'Revenue Attribution',
      value: '$24,580',
      target: '$30,000',
      percentage: 82,
      trend: 'down',
      trendValue: '-3%',
      icon: 'DollarSign',
      color: 'text-accent',
      bgColor: 'bg-accent/10'
    },
    {
      id: 'plan-vs-actual',
      title: 'Plan vs Actual',
      value: '89%',
      target: '95%',
      percentage: 94,
      trend: 'up',
      trendValue: '+7%',
      icon: 'Target',
      color: 'text-warning',
      bgColor: 'bg-warning/10'
    }
  ];

  const getTrendIcon = (trend) => {
    return trend === 'up' ? 'TrendingUp' : 'TrendingDown';
  };

  const getTrendColor = (trend) => {
    return trend === 'up' ? 'text-success' : 'text-error';
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 ${className}`}>
      {metricsData?.map((metric) => (
        <div
          key={metric?.id}
          className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${metric?.bgColor}`}>
              <Icon name={metric?.icon} size={20} className={metric?.color} />
            </div>
            <div className={`flex items-center space-x-1 ${getTrendColor(metric?.trend)}`}>
              <Icon name={getTrendIcon(metric?.trend)} size={14} />
              <span className="text-xs font-medium">{metric?.trendValue}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {metric?.title}
            </h3>
            
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-foreground">
                {metric?.value}
              </span>
              <span className="text-sm text-muted-foreground">
                / {metric?.target}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium text-foreground">{metric?.percentage}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    metric?.percentage >= 90 ? 'bg-success' :
                    metric?.percentage >= 70 ? 'bg-primary' :
                    metric?.percentage >= 50 ? 'bg-warning' : 'bg-error'
                  }`}
                  style={{ width: `${Math.min(metric?.percentage, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PerformanceMetrics;