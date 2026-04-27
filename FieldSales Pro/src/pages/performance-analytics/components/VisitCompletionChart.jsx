import React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const VisitCompletionChart = ({ data = [] }) => {
  const chartData = data.map((item) => ({
    date: item.label,
    completed: item.completed,
    planned: item.planned,
    efficiency: item.efficiency,
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.dataKey === 'efficiency' ? '%' : ' visits'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Τάσεις Ολοκλήρωσης Επισκέψεων</h3>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-primary rounded-full" />
            <span>Ολοκληρωμένες</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-muted rounded-full" />
            <span>Προγραμματισμένες</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-accent rounded-full" />
            <span>Αποδοτικότητα %</span>
          </div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              name="Ολοκληρωμένες Επισκέψεις"
              dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="planned"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Προγραμματισμένες Επισκέψεις"
              dot={{ fill: 'hsl(var(--muted-foreground))', strokeWidth: 2, r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="efficiency"
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              name="Αποδοτικότητα %"
              dot={{ fill: 'hsl(var(--accent))', strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default VisitCompletionChart;
