import React from 'react';
import Icon from '../../../components/AppIcon';

function getTrendFromChange(change) {
  return String(change || '').trim().startsWith('-') ? 'down' : 'up';
}

const PerformanceOverview = ({ data = null }) => {
  const overviewMetrics = [
    {
      id: 1,
      title: 'Ποσοστό Ολοκλήρωσης Επισκέψεων',
      value: `${data?.visitCompletionRate ?? 0}%`,
      change: data?.visitCompletionRateChange || '+0.0%',
      trend: getTrendFromChange(data?.visitCompletionRateChange),
      icon: 'Target',
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      id: 2,
      title: 'Μέσος Χρόνος ανά Επίσκεψη',
      value: `${data?.averageVisitDurationMinutes ?? 0} λεπτά`,
      change: data?.averageVisitDurationChange || '+0.0%',
      trend: getTrendFromChange(data?.averageVisitDurationChange),
      icon: 'Clock',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      id: 3,
      title: 'Κάλυψη Περιοχών',
      value: `${data?.territoryCoverageRate ?? 0}%`,
      change: data?.territoryCoverageRateChange || '+0.0%',
      trend: getTrendFromChange(data?.territoryCoverageRateChange),
      icon: 'Map',
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      id: 4,
      title: 'Ποσοστό Επίσκεψης-σε-Παραγγελία',
      value: `${data?.visitToOrderRate ?? 0}%`,
      change: data?.visitToOrderRateChange || '+0.0%',
      trend: getTrendFromChange(data?.visitToOrderRateChange),
      icon: 'TrendingUp',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {overviewMetrics.map((metric) => (
        <div key={metric.id} className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-lg ${metric.bgColor} flex items-center justify-center`}>
              <Icon name={metric.icon} size={24} className={metric.color} />
            </div>
            <div className={`flex items-center space-x-1 text-sm ${metric.trend === 'up' ? 'text-success' : 'text-error'}`}>
              <Icon name={metric.trend === 'up' ? 'ArrowUp' : 'ArrowDown'} size={16} />
              <span className="font-medium">{metric.change}</span>
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-foreground">{metric.value}</h3>
            <p className="text-sm text-muted-foreground">{metric.title}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PerformanceOverview;
