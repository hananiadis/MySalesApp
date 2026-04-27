import React from 'react';
import Icon from '../../../components/AppIcon';

const PerformanceMetrics = ({ className = '', data = null, loading = false }) => {
  const completed = data?.totalVisitsCompleted ?? null;
  const planned = data?.totalVisitsPlanned ?? null;
  const inProgress = data?.totalVisitsInProgress ?? null;
  const planVsActual = data?.planVsActual ?? null;
  const totalSalesmen = data?.totalSalesmen ?? null;
  const activeSalesmen = data?.activeSalesmen ?? null;

  const completedPct = planned > 0 ? Math.round((completed / planned) * 100) : 0;
  const inProgressPct = planned > 0 ? Math.round((inProgress / planned) * 100) : 0;
  const activePct = totalSalesmen > 0 ? Math.round((activeSalesmen / totalSalesmen) * 100) : 0;

  const metricsData = [
    {
      id: 'visits-completed',
      title: 'Ολοκληρωμένες Επισκέψεις',
      value: completed !== null ? String(completed) : '—',
      target: planned !== null ? String(planned) : '—',
      percentage: completedPct,
      icon: 'CheckCircle',
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      id: 'visits-in-progress',
      title: 'Επισκέψεις σε Εξέλιξη',
      value: inProgress !== null ? String(inProgress) : '—',
      target: planned !== null ? String(planned) : '—',
      percentage: inProgressPct,
      icon: 'MapPin',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      id: 'plan-vs-actual',
      title: 'Σχέδιο έναντι Πραγματικού',
      value: planVsActual !== null ? `${planVsActual}%` : '—',
      target: '100%',
      percentage: planVsActual ?? 0,
      icon: 'Target',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      id: 'active-salesmen',
      title: 'Ενεργοί Πωλητές',
      value: activeSalesmen !== null ? String(activeSalesmen) : '—',
      target: totalSalesmen !== null ? String(totalSalesmen) : '—',
      percentage: activePct,
      icon: 'Users',
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 ${className}`}>
      {metricsData?.map((metric) => (
        <div
          key={metric?.id}
          className={`bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow ${loading ? 'opacity-60 animate-pulse' : ''}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${metric?.bgColor}`}>
              <Icon name={metric?.icon} size={20} className={metric?.color} />
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
                <span className="text-muted-foreground">Πρόοδος</span>
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