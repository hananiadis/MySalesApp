import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Icon from '../../../components/AppIcon';

function getInitials(name = '') {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name.slice(0, 2) || '?').toUpperCase();
}

const SalesmanComparison = ({ data = [] }) => {
  const [selectedMetric, setSelectedMetric] = useState('visits');

  const metrics = [
    { key: 'visits', label: 'Σύνολο Επισκέψεων', icon: 'MapPin', color: '#2563EB' },
    { key: 'orders', label: 'Κλεισμένες Παραγγελίες', icon: 'ShoppingCart', color: '#059669' },
    { key: 'efficiency', label: 'Αποδοτικότητα (%)', icon: 'Target', color: '#7C3AED' },
    { key: 'conversionRate', label: 'Μετατροπή (%)', icon: 'TrendingUp', color: '#EA580C' },
    { key: 'travelTime', label: 'Μ.Ο. Travel Time (h)', icon: 'Route', color: '#0F766E' },
  ];

  const chartData = data.map((person) => ({
    name: person.name.split(' ')[0],
    fullName: person.name,
    [selectedMetric]: person[selectedMetric],
  }));

  const selectedMetricData = metrics.find((item) => item.key === selectedMetric);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const fullData = data.find((item) => item.name.split(' ')[0] === label);
      return (
        <div className="bg-popover border border-border rounded-lg p-4 shadow-lg">
          <p className="font-medium text-foreground mb-2">{fullData?.name}</p>
          <p className="text-sm text-muted-foreground">
            {selectedMetricData?.label}:{' '}
            {selectedMetric === 'efficiency' || selectedMetric === 'conversionRate'
              ? `${payload[0].value}%`
              : selectedMetric === 'travelTime'
                ? `${payload[0].value}h`
                : payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  const getRankIcon = (index) => {
    switch (index) {
      case 0:
        return { icon: 'Trophy', color: 'text-yellow-500' };
      case 1:
        return { icon: 'Medal', color: 'text-gray-400' };
      case 2:
        return { icon: 'Award', color: 'text-amber-600' };
      default:
        return { icon: 'User', color: 'text-muted-foreground' };
    }
  };

  const sortedSalesmen = [...data].sort((left, right) => {
    if (selectedMetric === 'travelTime') {
      return left[selectedMetric] - right[selectedMetric];
    }
    return right[selectedMetric] - left[selectedMetric];
  });

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
        <h3 className="text-lg font-semibold text-foreground">Σύγκριση Απόδοσης Πωλητών</h3>

        <div className="flex flex-wrap gap-2">
          {metrics.map((metric) => (
            <button
              key={metric.key}
              onClick={() => setSelectedMetric(metric.key)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                selectedMetric === metric.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Icon name={metric.icon} size={16} />
              <span>{metric.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={selectedMetric} fill={selectedMetricData?.color || '#2563EB'} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-foreground mb-4">Κατάταξη Απόδοσης</h4>
          {sortedSalesmen.slice(0, 5).map((person, index) => {
            const rankData = getRankIcon(index);
            return (
              <div key={person.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Icon name={rankData.icon} size={20} className={rankData.color} />
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-sm">
                    {getInitials(person.name)}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{person.name}</p>
                    <p className="text-sm text-muted-foreground">Θέση #{index + 1}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">
                    {selectedMetric === 'efficiency' || selectedMetric === 'conversionRate'
                      ? `${person[selectedMetric]}%`
                      : selectedMetric === 'travelTime'
                        ? `${person[selectedMetric]}h`
                        : person[selectedMetric]}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedMetricData?.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SalesmanComparison;
