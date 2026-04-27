import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import Icon from '../../../components/AppIcon';

const ConversionAnalytics = ({ data = null }) => {
  const conversionData = data?.outcomes || [];
  const pipeline = data?.pipeline || [];
  const engagementMetrics = data?.engagement || [];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{item.name}</p>
          <p className="text-sm text-muted-foreground">
            {item.value} επισκέψεις ({item.payload?.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Κατανομή Αποτελεσμάτων Επισκέψεων</h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={conversionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {conversionData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Ανάλυση Αποτελεσμάτων</h4>
            {conversionData.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium text-foreground">{item.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Απόδοση Pipeline ανά Αποτέλεσμα</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pipeline.map((item) => (
            <div key={item.outcome} className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg ${item.bgColor} flex items-center justify-center`}>
                  <Icon name={item.icon} size={20} className={item.color} />
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{item.visits} επισκέψεις</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-foreground">{item.outcome}</h4>
                <p className="text-2xl font-bold text-foreground">{item.visits}</p>
                <p className="text-sm text-muted-foreground">Μ.Ο.: {item.averagePerVisit}% επί των ολοκληρωμένων</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Δείκτες Εμπλοκής Πελάτη</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {engagementMetrics.map((metric) => (
            <div key={metric.label} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Icon name={metric.icon} size={18} className="text-primary" />
                  <span className="font-medium text-foreground">{metric.label}</span>
                </div>
                <span className="text-sm font-semibold text-foreground">{metric.value}%</span>
              </div>

              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${metric.value}%` }} />
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConversionAnalytics;
