import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const VisitCompletionChart = () => {
  const chartData = [
    { date: "Nov 1", completed: 85, planned: 100, efficiency: 78 },
    { date: "Nov 2", completed: 92, planned: 105, efficiency: 82 },
    { date: "Nov 3", completed: 78, planned: 95, efficiency: 75 },
    { date: "Nov 4", completed: 88, planned: 98, efficiency: 80 },
    { date: "Nov 5", completed: 95, planned: 110, efficiency: 85 },
    { date: "Nov 6", completed: 87, planned: 102, efficiency: 79 },
    { date: "Nov 7", completed: 91, planned: 108, efficiency: 83 }
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          {payload?.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry?.color }}>
              {entry?.name}: {entry?.value}
              {entry?.dataKey === 'efficiency' ? '%' : ' visits'}
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
        <h3 className="text-lg font-semibold text-foreground">Visit Completion Trends</h3>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-primary rounded-full"></div>
            <span>Completed</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-muted rounded-full"></div>
            <span>Planned</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-accent rounded-full"></div>
            <span>Efficiency %</span>
          </div>
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="completed" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Completed Visits"
              dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="planned" 
              stroke="hsl(var(--muted-foreground))" 
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Planned Visits"
              dot={{ fill: "hsl(var(--muted-foreground))", strokeWidth: 2, r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="efficiency" 
              stroke="hsl(var(--accent))" 
              strokeWidth={2}
              name="Efficiency %"
              dot={{ fill: "hsl(var(--accent))", strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default VisitCompletionChart;